from __future__ import annotations

import hashlib
import logging
import math
import random
import time
from typing import Literal, Protocol

import httpx

from .config import Settings

log = logging.getLogger(__name__)

InputType = Literal["document", "query"]


class Embedder(Protocol):
    dim: int

    def embed(self, texts: list[str], input_type: InputType) -> list[list[float]]: ...


class EmbeddingError(Exception):
    pass


class VoyageEmbedder:
    """Voyage AI embeddings over HTTP, with batching and retry on rate limits
    and transient server errors."""

    url = "https://api.voyageai.com/v1/embeddings"

    def __init__(self, api_key: str, model: str, dim: int, batch_size: int = 64,
                 max_retries: int = 6, client: httpx.Client | None = None) -> None:
        if not api_key:
            raise EmbeddingError("DDC_VOYAGE_API_KEY is not set")
        self.model, self.dim, self.batch_size = model, dim, batch_size
        self.max_retries = max_retries
        self.client = client or httpx.Client(
            timeout=httpx.Timeout(60.0, connect=10.0),
            headers={"Authorization": f"Bearer {api_key}"},
        )

    def embed(self, texts: list[str], input_type: InputType) -> list[list[float]]:
        vectors: list[list[float]] = []
        for start in range(0, len(texts), self.batch_size):
            vectors.extend(self._embed_batch(texts[start:start + self.batch_size], input_type))
        return vectors

    def _embed_batch(self, texts: list[str], input_type: InputType) -> list[list[float]]:
        payload = {"model": self.model, "input": texts, "input_type": input_type}
        for attempt in range(self.max_retries + 1):
            try:
                resp = self.client.post(self.url, json=payload)
            except httpx.TransportError as exc:
                if attempt == self.max_retries:
                    raise EmbeddingError(f"embedding request failed: {exc}") from exc
                self._sleep(attempt, None)
                continue
            if resp.status_code == 200:
                data = sorted(resp.json()["data"], key=lambda d: d["index"])
                vectors = [d["embedding"] for d in data]
                if any(len(v) != self.dim for v in vectors):
                    raise EmbeddingError(
                        f"{self.model} returned vectors of the wrong size, expected {self.dim}")
                return vectors
            if resp.status_code in (429, 500, 502, 503, 504) and attempt < self.max_retries:
                self._sleep(attempt, resp.headers.get("retry-after"))
                continue
            raise EmbeddingError(f"embedding API error {resp.status_code}: {resp.text[:300]}")
        raise EmbeddingError("embedding retries exhausted")

    @staticmethod
    def _sleep(attempt: int, retry_after: str | None) -> None:
        delay = float(retry_after) if retry_after and retry_after.isdigit() else 2 ** attempt
        delay = min(delay, 60) + random.uniform(0, 1)
        log.warning("embedding API busy, retrying in %.1fs", delay)
        time.sleep(delay)


class FakeEmbedder:
    """Deterministic embeddings for tests and offline development. Texts that
    share words get similar vectors, so retrieval tests behave sensibly."""

    def __init__(self, dim: int = 1024) -> None:
        self.dim = dim

    def embed(self, texts: list[str], input_type: InputType) -> list[list[float]]:
        return [self._vector(t) for t in texts]

    def _vector(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        for word in text.lower().split():
            h = int.from_bytes(hashlib.blake2b(word.encode(), digest_size=8).digest(), "big")
            vec[h % self.dim] += 1.0 if (h >> 32) & 1 else -1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]


def make_embedder(settings: Settings) -> Embedder:
    if settings.embedding_provider == "fake":
        return FakeEmbedder(settings.embedding_dim)
    return VoyageEmbedder(
        api_key=settings.voyage_api_key.get_secret_value(),
        model=settings.embedding_model,
        dim=settings.embedding_dim,
        batch_size=settings.embedding_batch_size,
    )
