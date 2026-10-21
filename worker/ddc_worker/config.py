from __future__ import annotations

import socket
from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="DDC_", extra="ignore")

    database_url: str = "postgresql://postgres@localhost:54322/postgres"

    storage_backend: Literal["supabase", "local"] = "supabase"
    supabase_url: str = ""
    supabase_service_role_key: SecretStr = SecretStr("")
    storage_bucket: str = "documents"
    local_storage_dir: str = ".local-storage"

    embedding_provider: Literal["voyage", "fake"] = "voyage"
    voyage_api_key: SecretStr = SecretStr("")
    # voyage-finance-2 is tuned for financial text; must match the column
    # dimension in the chunks table.
    embedding_model: str = "voyage-finance-2"
    embedding_dim: int = 1024
    embedding_batch_size: int = 64

    chunk_target_tokens: int = 400
    chunk_max_tokens: int = 800
    chunk_overlap_tokens: int = 60

    max_file_bytes: int = 100 * 1024 * 1024
    worker_id: str = Field(default_factory=lambda: f"{socket.gethostname()}")
    poll_interval_seconds: float = 5.0
    job_lease_minutes: int = 15
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
