"""Split parsed documents into retrieval chunks.

Chunks follow the document's structure: they never cross a section heading,
tables are kept whole (or split by rows with the header repeated), and every
chunk records the pages it came from so answers can cite them.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

from .parsing import ParsedDocument

_TOKEN = re.compile(r"\w+|[^\w\s]")
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9(\"'])")


def estimate_tokens(text: str) -> int:
    """Rough token count. Counting words and punctuation separately slightly
    overestimates subword tokenizers, which is the safe direction here."""
    return len(_TOKEN.findall(text))


@dataclass
class Chunk:
    index: int
    chunk_type: Literal["text", "table"]
    section: str | None
    page_start: int
    page_end: int
    content: str
    token_count: int
    metadata: dict = field(default_factory=dict)


@dataclass
class _Unit:
    text: str
    page: int
    tokens: int


class _Chunker:
    def __init__(self, target: int, maximum: int, overlap: int) -> None:
        self.target, self.maximum, self.overlap = target, maximum, overlap
        self.chunks: list[Chunk] = []
        self.buffer: list[_Unit] = []
        self.headings: list[tuple[int, str]] = []
        self.last_paragraph: _Unit | None = None

    @property
    def section(self) -> str | None:
        return " > ".join(text for _, text in self.headings) or None

    def emit(self, kind: str, units: list[_Unit], content: str, **metadata) -> None:
        self.chunks.append(Chunk(
            index=len(self.chunks),
            chunk_type=kind,  # type: ignore[arg-type]
            section=self.section,
            page_start=min(u.page for u in units),
            page_end=max(u.page for u in units),
            content=content,
            token_count=estimate_tokens(content),
            metadata=metadata,
        ))

    def flush(self, keep_overlap: bool = False) -> None:
        if not self.buffer:
            return
        self.emit("text", self.buffer, "\n\n".join(u.text for u in self.buffer))
        if keep_overlap:
            carried, total = [], 0
            for unit in reversed(self.buffer):
                if total + unit.tokens > self.overlap:
                    break
                carried.insert(0, unit)
                total += unit.tokens
            # Never carry the whole buffer, or the next chunk is a duplicate.
            self.buffer = carried if len(carried) < len(self.buffer) else []
        else:
            self.buffer = []

    def heading(self, text: str, level: int) -> None:
        self.flush()
        self.headings = [(lvl, t) for lvl, t in self.headings if lvl < level]
        self.headings.append((level, text))
        self.last_paragraph = None

    def text(self, text: str, page: int) -> None:
        for piece in self._split(text):
            unit = _Unit(piece, page, estimate_tokens(piece))
            buffered = sum(u.tokens for u in self.buffer)
            if self.buffer and buffered + unit.tokens > self.maximum:
                self.flush(keep_overlap=True)
            self.buffer.append(unit)
            if sum(u.tokens for u in self.buffer) >= self.target:
                self.flush(keep_overlap=True)
        self.last_paragraph = _Unit(text, page, estimate_tokens(text))

    def table(self, markdown: str, page: int) -> None:
        # A short paragraph right before a table is usually its title
        # ("Consolidated Statements of Operations"); keep it with the table.
        caption = None
        if self.last_paragraph and self.last_paragraph.tokens <= 40:
            caption = self.last_paragraph.text
        self.flush()
        self.last_paragraph = None

        lines = markdown.splitlines()
        header, rows = lines[:2], lines[2:]
        prefix = (caption + "\n\n") if caption else ""
        fixed = estimate_tokens(prefix + "\n".join(header))
        part: list[str] = []
        parts: list[list[str]] = []
        size = fixed
        for row in rows:
            row_tokens = estimate_tokens(row)
            if part and size + row_tokens > self.maximum:
                parts.append(part)
                part, size = [], fixed
            part.append(row)
            size += row_tokens
        parts.append(part)

        for i, part in enumerate(parts):
            content = prefix + "\n".join(header + part)
            meta = {"table_part": i + 1, "table_parts": len(parts)} if len(parts) > 1 else {}
            if caption:
                meta["caption"] = caption
            self.emit("table", [_Unit("", page, 0)], content, **meta)

    def _split(self, text: str) -> list[str]:
        """Break an oversized paragraph into sentences (and run-on sentences
        at word boundaries) so chunks can end, and overlap, cleanly."""
        if estimate_tokens(text) <= self.maximum // 2:
            return [text]
        return [part for sentence in _SENTENCE_END.split(text)
                for part in self._split_words(sentence)]

    def _split_words(self, sentence: str) -> list[str]:
        if estimate_tokens(sentence) <= self.target // 2:
            return [sentence]
        words, out, current = sentence.split(), [], []
        for word in words:
            current.append(word)
            if estimate_tokens(" ".join(current)) >= self.target // 2:
                out.append(" ".join(current))
                current = []
        if current:
            out.append(" ".join(current))
        return out


def chunk_document(
    doc: ParsedDocument,
    target_tokens: int = 400,
    max_tokens: int = 800,
    overlap_tokens: int = 60,
) -> list[Chunk]:
    chunker = _Chunker(target_tokens, max_tokens, overlap_tokens)
    for page in doc.pages:
        for block in page.blocks:
            if not block.text.strip():
                continue
            if block.kind == "heading":
                chunker.heading(block.text, block.level)
            elif block.kind == "table":
                chunker.table(block.text, page.number)
            else:
                chunker.text(block.text, page.number)
    chunker.flush()
    return chunker.chunks
