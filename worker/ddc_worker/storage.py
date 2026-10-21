from __future__ import annotations

from pathlib import Path
from typing import Protocol
from urllib.parse import quote

import httpx

from .config import Settings


class StorageError(Exception):
    pass


class Storage(Protocol):
    def download(self, path: str, max_bytes: int) -> bytes: ...


class SupabaseStorage:
    def __init__(self, url: str, service_key: str, bucket: str,
                 client: httpx.Client | None = None) -> None:
        if not url or not service_key:
            raise StorageError("DDC_SUPABASE_URL and DDC_SUPABASE_SERVICE_ROLE_KEY are required")
        self.base = url.rstrip("/") + "/storage/v1/object"
        self.bucket = bucket
        self.client = client or httpx.Client(
            timeout=httpx.Timeout(120.0, connect=10.0),
            headers={"Authorization": f"Bearer {service_key}", "apikey": service_key},
        )

    def download(self, path: str, max_bytes: int) -> bytes:
        url = f"{self.base}/{self.bucket}/{quote(path)}"
        with self.client.stream("GET", url) as resp:
            if resp.status_code == 404:
                raise StorageError(f"file not found in storage: {path}")
            if resp.status_code != 200:
                raise StorageError(f"storage error {resp.status_code}")
            chunks, total = [], 0
            for chunk in resp.iter_bytes():
                total += len(chunk)
                if total > max_bytes:
                    raise StorageError(f"file exceeds {max_bytes} bytes")
                chunks.append(chunk)
        return b"".join(chunks)


class LocalStorage:
    """Reads files from a local directory laid out like the storage bucket."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()

    def download(self, path: str, max_bytes: int) -> bytes:
        target = (self.root / path).resolve()
        if not target.is_relative_to(self.root):
            raise StorageError("path escapes storage root")
        if not target.is_file():
            raise StorageError(f"file not found in storage: {path}")
        if target.stat().st_size > max_bytes:
            raise StorageError(f"file exceeds {max_bytes} bytes")
        return target.read_bytes()


def make_storage(settings: Settings) -> Storage:
    if settings.storage_backend == "local":
        return LocalStorage(settings.local_storage_dir)
    return SupabaseStorage(
        settings.supabase_url,
        settings.supabase_service_role_key.get_secret_value(),
        settings.storage_bucket,
    )
