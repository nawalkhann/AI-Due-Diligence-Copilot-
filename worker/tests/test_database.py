"""Row level security and queue behaviour, tested against the real migrations."""

import hashlib
import uuid

import psycopg
import pytest
from conftest import AsUser, make_user


def create_workspace(db, user_id, name="Fund I"):
    with AsUser(db, user_id) as conn:
        return str(conn.execute("select public.create_workspace(%s)", (name,)).fetchone()[0])


def insert_document(conn, ws, content=b"hello", name="a.pdf"):
    doc_id = uuid.uuid4()
    sha = hashlib.sha256(content + doc_id.bytes).hexdigest()
    return str(conn.execute(
        """insert into public.documents (id, workspace_id, title, file_name, storage_path,
               mime_type, size_bytes, sha256)
           values (%s, %s, 'Annual report', %s, %s, 'application/pdf', %s, %s) returning id""",
        (doc_id, ws, name, f"{ws}/{doc_id}/{name}", len(content), sha)).fetchone()[0])


def test_creator_becomes_owner_and_others_see_nothing(db):
    alice, bob = make_user(db), make_user(db)
    ws = create_workspace(db, alice)
    with AsUser(db, alice) as conn:
        role = conn.execute("select role from public.workspace_members where workspace_id = %s",
                            (ws,)).fetchone()[0]
        assert role == "owner"
        insert_document(conn, ws)
    with AsUser(db, bob) as conn:
        assert conn.execute("select count(*) from public.workspaces").fetchone()[0] == 0
        assert conn.execute("select count(*) from public.documents").fetchone()[0] == 0


def test_workspaces_cannot_be_inserted_directly(db):
    alice = make_user(db)
    with pytest.raises(psycopg.errors.InsufficientPrivilege), AsUser(db, alice) as conn:
        conn.execute("insert into public.workspaces (name, created_by) values ('x', %s)",
                     (alice,))


def test_outsider_cannot_insert_into_someone_elses_workspace(db):
    alice, mallory = make_user(db), make_user(db)
    ws = create_workspace(db, alice)
    with pytest.raises(psycopg.errors.InsufficientPrivilege), AsUser(db, mallory) as conn:
        insert_document(conn, ws)


def test_cannot_join_workspace_by_inserting_membership(db):
    alice, mallory = make_user(db), make_user(db)
    ws = create_workspace(db, alice)
    with pytest.raises(psycopg.errors.InsufficientPrivilege), AsUser(db, mallory) as conn:
        conn.execute("insert into public.workspace_members (workspace_id, user_id, role)"
                     " values (%s, %s, 'owner')", (ws, mallory))


def test_viewer_can_read_but_not_upload(db):
    alice, victor = make_user(db), make_user(db)
    ws = create_workspace(db, alice)
    with AsUser(db, alice) as conn:
        conn.execute("insert into public.workspace_members values (%s, %s, 'viewer')",
                     (ws, victor))
        insert_document(conn, ws)
    with AsUser(db, victor) as conn:
        assert conn.execute("select count(*) from public.documents").fetchone()[0] == 1
    with pytest.raises(psycopg.errors.InsufficientPrivilege), AsUser(db, victor) as conn:
        insert_document(conn, ws, b"other")


def test_admin_cannot_grant_owner(db):
    alice, adam, eve = make_user(db), make_user(db), make_user(db)
    ws = create_workspace(db, alice)
    with AsUser(db, alice) as conn:
        conn.execute("insert into public.workspace_members values (%s, %s, 'admin')", (ws, adam))
    with pytest.raises(psycopg.errors.InsufficientPrivilege), AsUser(db, adam) as conn:
        conn.execute("insert into public.workspace_members values (%s, %s, 'owner')", (ws, eve))


def test_users_cannot_set_status_or_write_chunks(db):
    alice = make_user(db)
    ws = create_workspace(db, alice)
    with AsUser(db, alice) as conn:
        doc = insert_document(conn, ws)
    with pytest.raises(psycopg.errors.InsufficientPrivilege), AsUser(db, alice) as conn:
        conn.execute("update public.documents set status = 'ready' where id = %s", (doc,))
    with pytest.raises(psycopg.errors.InsufficientPrivilege), AsUser(db, alice) as conn:
        conn.execute("insert into public.document_pages values (%s, %s, 1, 'x')", (doc, ws))


def test_storage_path_must_be_inside_workspace(db):
    alice = make_user(db)
    ws, other = create_workspace(db, alice), create_workspace(db, alice, "Fund II")
    with pytest.raises(psycopg.errors.CheckViolation), AsUser(db, alice) as conn:
        conn.execute(
            """insert into public.documents (workspace_id, title, file_name, storage_path,
                   mime_type, size_bytes, sha256)
               values (%s, 't', 'a.pdf', %s, 'application/pdf', 1, %s)""",
            (ws, f"{other}/x/a.pdf", "0" * 64))


def test_company_must_belong_to_same_workspace(db):
    alice = make_user(db)
    ws, other = create_workspace(db, alice), create_workspace(db, alice, "Fund II")
    with AsUser(db, alice) as conn:
        company = conn.execute("insert into public.companies (workspace_id, name)"
                               " values (%s, 'Acme') returning id", (other,)).fetchone()[0]
        doc = insert_document(conn, ws)
    with pytest.raises(psycopg.errors.ForeignKeyViolation), AsUser(db, alice) as conn:
        conn.execute("update public.documents set company_id = %s where id = %s",
                     (company, doc))


def test_queue_document_creates_one_job_and_claim_skips_locked(db):
    alice, bob = make_user(db), make_user(db)
    ws = create_workspace(db, alice)
    with AsUser(db, alice) as conn:
        doc = insert_document(conn, ws)
        conn.execute("select public.queue_document(%s)", (doc,))
        status = conn.execute("select status from public.documents where id = %s",
                              (doc,)).fetchone()[0]
        assert status == "queued"
    with pytest.raises(psycopg.errors.ObjectNotInPrerequisiteState), AsUser(db, alice) as conn:
        conn.execute("select public.queue_document(%s)", (doc,))
    with pytest.raises(psycopg.errors.NoDataFound), AsUser(db, bob) as conn:
        conn.execute("select public.queue_document(%s)", (doc,))

    # users cannot claim jobs; only the worker (service connection) can
    with pytest.raises(psycopg.errors.InsufficientPrivilege), AsUser(db, alice) as conn:
        conn.execute("select * from public.claim_ingestion_job('x')")

    first = db.execute("select id, attempts from public.claim_ingestion_job('w1')").fetchall()
    assert len(first) == 1 and first[0][1] == 1
    assert db.execute("select * from public.claim_ingestion_job('w2')").fetchall() == []

    # an expired lease is reclaimed by another worker
    db.execute("update public.ingestion_jobs set locked_at = now() - interval '1 hour'")
    again = db.execute("select id, attempts, locked_by from public.claim_ingestion_job('w2')")
    assert again.fetchone()[1:] == (2, "w2")
