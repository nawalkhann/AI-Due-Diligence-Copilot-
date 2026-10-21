"""End to end: upload -> queue -> worker -> pages and searchable chunks."""

import hashlib
import uuid

import pytest
from conftest import AsUser, make_user

from ddc_worker.config import Settings
from ddc_worker.embeddings import EmbeddingError, FakeEmbedder
from ddc_worker.pipeline import claim_job, run_job
from ddc_worker.runner import connect
from ddc_worker.storage import LocalStorage


@pytest.fixture
def settings(database_url, tmp_path):
    return Settings(database_url=database_url, storage_backend="local",
                    local_storage_dir=str(tmp_path), embedding_provider="fake",
                    worker_id="test-worker")


def upload(db, settings, data: bytes, name: str, sha: str | None = None):
    user = make_user(db)
    with AsUser(db, user) as conn:
        ws = str(conn.execute("select public.create_workspace('Fund')").fetchone()[0])
        company = conn.execute("insert into public.companies (workspace_id, name)"
                               " values (%s, 'Acme Robotics') returning id", (ws,)).fetchone()[0]
        doc_id = uuid.uuid4()
        path = f"{ws}/{doc_id}/{name}"
        conn.execute(
            """insert into public.documents (id, workspace_id, company_id, title, doc_type,
                   file_name, storage_path, mime_type, size_bytes, sha256)
               values (%s, %s, %s, 'FY2025 Annual Report', 'annual_report', %s, %s,
                       'application/octet-stream', %s, %s)""",
            (doc_id, ws, company, name, path, len(data),
             sha or hashlib.sha256(data).hexdigest()))
        conn.execute("select public.queue_document(%s)", (doc_id,))
    target = LocalStorage(settings.local_storage_dir).root / path
    target.parent.mkdir(parents=True)
    target.write_bytes(data)
    return str(doc_id), ws, user


def process_next(settings, embedder=None):
    with connect(settings) as conn:
        job = claim_job(conn, settings.worker_id, settings.job_lease_minutes)
        assert job is not None
        return run_job(conn, job, LocalStorage(settings.local_storage_dir),
                       embedder or FakeEmbedder(settings.embedding_dim), settings)


def test_pdf_becomes_cited_searchable_chunks(db, settings, sample_pdf):
    doc_id, ws, user = upload(db, settings, sample_pdf, "annual-report.pdf")
    assert process_next(settings) is True

    doc = db.execute("select status, page_count, chunk_count, error from public.documents"
                     " where id = %s", (doc_id,)).fetchone()
    assert doc[0] == "ready" and doc[1] == 4 and doc[2] >= 3 and doc[3] is None

    job = db.execute("select status from public.ingestion_jobs where document_id = %s",
                     (doc_id,)).fetchone()
    assert job[0] == "succeeded"

    # the member can read pages and chunks, with page numbers for citations
    with AsUser(db, user) as conn:
        pages = conn.execute("select count(*) from public.document_pages where document_id = %s",
                             (doc_id,)).fetchone()[0]
        assert pages == 4
        table = conn.execute(
            "select page_start, section, content from public.chunks"
            " where document_id = %s and chunk_type = 'table'", (doc_id,)).fetchone()
        assert table[0] == 2
        assert "Consolidated Statements of Operations" in (table[1] + table[2])

        # keyword search finds the risk factor
        hit = conn.execute(
            "select page_start from public.chunks"
            " where fts @@ websearch_to_tsquery('english', 'largest customers revenue')"
        ).fetchone()
        assert hit[0] == 1

    # a different user sees none of it
    with AsUser(db, make_user(db)) as conn:
        assert conn.execute("select count(*) from public.chunks where workspace_id = %s",
                            (ws,)).fetchone()[0] == 0


def test_vector_search_ranks_relevant_chunk_first(db, settings, sample_pdf):
    doc_id, _, _ = upload(db, settings, sample_pdf, "ar.pdf")
    process_next(settings)
    query = FakeEmbedder().embed(["largest customers accounted for revenue"], "query")[0]
    literal = "[" + ",".join(map(str, query)) + "]"
    page = db.execute(
        "select page_start from public.chunks where document_id = %s"
        " order by embedding operator(extensions.<=>) %s::extensions.vector limit 1",
        (doc_id, literal)).fetchone()[0]
    assert page == 1


def test_reprocessing_replaces_previous_output(db, settings, sample_html):
    doc_id, _, user = upload(db, settings, sample_html, "10k.htm")
    process_next(settings)
    first = db.execute("select count(*) from public.chunks where document_id = %s",
                       (doc_id,)).fetchone()[0]
    with AsUser(db, user) as conn:
        conn.execute("select public.queue_document(%s)", (doc_id,))
    process_next(settings)
    again = db.execute("select count(*) from public.chunks where document_id = %s",
                       (doc_id,)).fetchone()[0]
    assert again == first


def test_checksum_mismatch_fails_without_retry(db, settings, sample_pdf):
    doc_id, _, _ = upload(db, settings, sample_pdf, "ar.pdf", sha="0" * 64)
    assert process_next(settings) is False
    status, error = db.execute("select status, error from public.documents where id = %s",
                               (doc_id,)).fetchone()
    assert status == "failed" and "checksum" in error
    assert db.execute("select status from public.ingestion_jobs where document_id = %s",
                      (doc_id,)).fetchone()[0] == "failed"


def test_unsupported_file_fails_with_clear_message(db, settings):
    doc_id, _, _ = upload(db, settings, b"\x00\x01binary", "data.bin")
    process_next(settings)
    error = db.execute("select error from public.documents where id = %s", (doc_id,)).fetchone()[0]
    assert "unsupported file type" in error


class FlakyEmbedder(FakeEmbedder):
    def embed(self, texts, input_type):
        raise EmbeddingError("embedding API error 503")


def test_transient_failure_is_requeued_with_backoff(db, settings, sample_xlsx):
    doc_id, _, _ = upload(db, settings, sample_xlsx, "model.xlsx")
    assert process_next(settings, FlakyEmbedder()) is False
    job = db.execute(
        "select status, attempts, run_after > now(), last_error from public.ingestion_jobs"
        " where document_id = %s", (doc_id,)).fetchone()
    assert job[:3] == ("queued", 1, True) and "503" in job[3]
    assert db.execute("select status from public.documents where id = %s",
                      (doc_id,)).fetchone()[0] == "queued"
    # after the final attempt the document is marked failed
    db.execute("update public.ingestion_jobs set run_after = now(), attempts = max_attempts - 1"
               " where document_id = %s", (doc_id,))
    process_next(settings, FlakyEmbedder())
    assert db.execute("select status from public.documents where id = %s",
                      (doc_id,)).fetchone()[0] == "failed"
