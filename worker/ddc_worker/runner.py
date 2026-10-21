from __future__ import annotations

import json
import logging
import signal
import sys
import time

import psycopg

from .config import Settings
from .embeddings import make_embedder
from .pipeline import claim_job, run_job
from .storage import make_storage

log = logging.getLogger(__name__)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            entry["exc"] = self.formatException(record.exc_info)
        return json.dumps(entry)


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logging.basicConfig(level=level.upper(), handlers=[handler], force=True)


def connect(settings: Settings) -> psycopg.Connection:
    return psycopg.connect(settings.database_url, autocommit=True,
                           application_name=f"ddc-worker:{settings.worker_id}")


def run_forever(settings: Settings) -> None:
    """Process jobs until SIGTERM/SIGINT. Wakes immediately on new uploads via
    LISTEN/NOTIFY and polls as a fallback. Run several processes to scale."""
    stopping = False

    def stop(signum, _frame):
        nonlocal stopping
        log.info("received signal %s, finishing current job then exiting", signum)
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    storage = make_storage(settings)
    embedder = make_embedder(settings)
    backoff = 1.0
    while not stopping:
        try:
            with connect(settings) as conn, connect(settings) as listen_conn:
                listen_conn.execute("listen ingestion_jobs")
                log.info("worker %s started", settings.worker_id)
                backoff = 1.0
                while not stopping:
                    job = claim_job(conn, settings.worker_id, settings.job_lease_minutes)
                    if job:
                        log.info("claimed job %s for document %s (attempt %s)",
                                 job.id, job.document_id, job.attempts)
                        run_job(conn, job, storage, embedder, settings)
                        continue
                    # Nothing to do: sleep until notified or the poll interval passes.
                    for _ in listen_conn.notifies(timeout=settings.poll_interval_seconds,
                                                  stop_after=1):
                        pass
        except psycopg.OperationalError:
            log.exception("database connection lost; reconnecting in %.0fs", backoff)
            time.sleep(backoff)
            backoff = min(backoff * 2, 60)
    log.info("worker stopped")


def run_once(settings: Settings) -> int:
    """Drain the queue and exit. Useful for tests and cron-style deployments."""
    storage = make_storage(settings)
    embedder = make_embedder(settings)
    processed = 0
    with connect(settings) as conn:
        while job := claim_job(conn, settings.worker_id, settings.job_lease_minutes):
            run_job(conn, job, storage, embedder, settings)
            processed += 1
    return processed
