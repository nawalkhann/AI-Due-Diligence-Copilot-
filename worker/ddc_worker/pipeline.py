"""Turn one queued document into searchable pages and chunks."""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import timedelta

import psycopg
from psycopg.rows import dict_row

from .chunking import Chunk, chunk_document
from .config import Settings
from .embeddings import Embedder, EmbeddingError
from .parsing import ParsedDocument, UnsupportedDocument, parse_document
from .storage import Storage, StorageError

log = logging.getLogger(__name__)

DOC_TYPE_LABELS = {
    "annual_report": "Annual report",
    "quarterly_report": "Quarterly report",
    "filing_other": "Regulatory filing",
    "financial_statement": "Financial statement",
    "investor_presentation": "Investor presentation",
    "market_report": "Market report",
    "other": "Document",
}


class PermanentFailure(Exception):
    """Retrying will not help (bad file, unsupported type, checksum mismatch)."""


@dataclass
class Job:
    id: int
    document_id: str
    attempts: int
    max_attempts: int


def claim_job(conn: psycopg.Connection, worker_id: str, lease_minutes: int) -> Job | None:
    with conn.transaction(), conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "select id, document_id::text, attempts, max_attempts"
            " from public.claim_ingestion_job(%s, %s)",
            (worker_id, timedelta(minutes=lease_minutes)),
        )
        row = cur.fetchone()
    return Job(**row) if row else None


def run_job(conn: psycopg.Connection, job: Job, storage: Storage, embedder: Embedder,
            settings: Settings) -> bool:
    """Process a claimed job. Returns True on success. Never raises for
    document-level failures; they are recorded on the job and document."""
    try:
        doc = _load_document(conn, job.document_id)
        _set_document_status(conn, job.document_id, "processing")
        parsed, chunks = _extract(doc, storage, settings)
        vectors = embedder.embed([embedding_text(doc, c) for c in chunks], "document")
        _store(conn, job, doc, parsed, chunks, vectors)
        log.info("document %s ready: %d pages, %d chunks",
                 job.document_id, parsed.page_count, len(chunks))
        return True
    except PermanentFailure as exc:
        _fail(conn, job, str(exc), retry=False)
    except (EmbeddingError, StorageError, psycopg.OperationalError) as exc:
        _fail(conn, job, str(exc), retry=True)
    except Exception as exc:
        log.exception("unexpected error processing document %s", job.document_id)
        _fail(conn, job, f"internal error: {type(exc).__name__}", retry=True)
    return False


def _load_document(conn: psycopg.Connection, document_id: str) -> dict:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select d.id::text, d.workspace_id::text, d.title, d.doc_type, d.period_end,
                   d.file_name, d.storage_path, d.sha256, c.name as company_name
            from public.documents d
            left join public.companies c on c.id = d.company_id
            where d.id = %s
            """,
            (document_id,),
        )
        row = cur.fetchone()
    conn.commit()
    if row is None:
        raise PermanentFailure("document no longer exists")
    return row


def _extract(doc: dict, storage: Storage, settings: Settings
             ) -> tuple[ParsedDocument, list[Chunk]]:
    try:
        data = storage.download(doc["storage_path"], settings.max_file_bytes)
    except StorageError as exc:
        if "not found" in str(exc) or "exceeds" in str(exc):
            raise PermanentFailure(str(exc)) from exc
        raise
    if hashlib.sha256(data).hexdigest() != doc["sha256"]:
        raise PermanentFailure("file in storage does not match the uploaded checksum")
    try:
        parsed = parse_document(data, doc["file_name"])
    except UnsupportedDocument as exc:
        raise PermanentFailure(str(exc)) from exc
    chunks = chunk_document(
        parsed,
        target_tokens=settings.chunk_target_tokens,
        max_tokens=settings.chunk_max_tokens,
        overlap_tokens=settings.chunk_overlap_tokens,
    )
    if not chunks:
        raise PermanentFailure("no readable text found in the document")
    return parsed, chunks


def embedding_text(doc: dict, chunk: Chunk) -> str:
    """Prefix each chunk with where it comes from. A passage like "revenue grew
    12%" is only findable for the right company if the embedding knows the
    company, document and section."""
    parts = [DOC_TYPE_LABELS.get(doc["doc_type"], "Document") + ": " + doc["title"]]
    if doc.get("company_name"):
        parts.append("Company: " + doc["company_name"])
    if doc.get("period_end"):
        parts.append(f"Period ending {doc['period_end']}")
    if chunk.section:
        parts.append("Section: " + chunk.section)
    return " | ".join(parts) + "\n\n" + chunk.content


def _vector_literal(vec: list[float]) -> str:
    return "[" + ",".join(f"{v:.7g}" for v in vec) + "]"


def _store(conn: psycopg.Connection, job: Job, doc: dict, parsed: ParsedDocument,
           chunks: list[Chunk], vectors: list[list[float]]) -> None:
    ws, doc_id = doc["workspace_id"], doc["id"]
    with conn.transaction(), conn.cursor() as cur:
        # Re-processing replaces earlier output.
        cur.execute("delete from public.chunks where document_id = %s", (doc_id,))
        cur.execute("delete from public.document_pages where document_id = %s", (doc_id,))
        cur.executemany(
            "insert into public.document_pages (document_id, workspace_id, page_number, content)"
            " values (%s, %s, %s, %s)",
            [(doc_id, ws, p.number, p.text) for p in parsed.pages if p.text],
        )
        cur.executemany(
            """
            insert into public.chunks (document_id, workspace_id, chunk_index, chunk_type,
                section, page_start, page_end, content, token_count, embedding, metadata)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::extensions.vector, %s)
            """,
            [
                (doc_id, ws, c.index, c.chunk_type, c.section, c.page_start, c.page_end,
                 c.content, c.token_count, _vector_literal(v), json.dumps(c.metadata))
                for c, v in zip(chunks, vectors, strict=True)
            ],
        )
        cur.execute(
            """
            update public.documents
               set status = 'ready', error = null, page_count = %s, chunk_count = %s,
                   warnings = %s
             where id = %s
            """,
            (parsed.page_count, len(chunks), json.dumps(parsed.warnings), doc_id),
        )
        cur.execute(
            "update public.ingestion_jobs set status = 'succeeded', finished_at = now(),"
            " last_error = null where id = %s",
            (job.id,),
        )


def _set_document_status(conn: psycopg.Connection, document_id: str, status: str) -> None:
    with conn.transaction():
        conn.execute("update public.documents set status = %s where id = %s",
                     (status, document_id))


def _fail(conn: psycopg.Connection, job: Job, message: str, retry: bool) -> None:
    conn.rollback()
    message = message[:1000]
    will_retry = retry and job.attempts < job.max_attempts
    log.warning("job %s for document %s failed (%s): %s", job.id, job.document_id,
                "will retry" if will_retry else "giving up", message)
    with conn.transaction():
        if will_retry:
            # exponential backoff: 1, 4, 16 minutes...
            conn.execute(
                "update public.ingestion_jobs set status = 'queued', last_error = %s,"
                " locked_at = null, locked_by = null,"
                " run_after = now() + make_interval(mins => power(4, attempts - 1)::int)"
                " where id = %s",
                (message, job.id),
            )
            conn.execute("update public.documents set status = 'queued' where id = %s",
                         (job.document_id,))
        else:
            conn.execute(
                "update public.ingestion_jobs set status = 'failed', last_error = %s,"
                " finished_at = now() where id = %s",
                (message, job.id),
            )
            conn.execute(
                "update public.documents set status = 'failed', error = %s where id = %s",
                (message, job.document_id),
            )
