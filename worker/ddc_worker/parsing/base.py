from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

BlockKind = Literal["heading", "text", "table"]


@dataclass
class Block:
    kind: BlockKind
    text: str
    # Heading depth, 1 is the top level. Only meaningful for headings.
    level: int = 1


@dataclass
class Page:
    """One citable unit of a source: a PDF page, a slide, a sheet, or a
    page-break-delimited section of an HTML filing."""

    number: int
    blocks: list[Block] = field(default_factory=list)
    label: str | None = None  # e.g. sheet name or slide title

    @property
    def text(self) -> str:
        return "\n\n".join(b.text for b in self.blocks if b.text.strip())


@dataclass
class ParsedDocument:
    pages: list[Page]
    warnings: list[str] = field(default_factory=list)

    @property
    def page_count(self) -> int:
        return len(self.pages)


class UnsupportedDocument(Exception):
    """The file type is not supported, or the file is not what it claims to be."""


def rows_to_markdown(rows: list[list[str]]) -> str:
    """Render a table as GitHub-flavoured markdown, which LLMs read reliably.
    The first row is treated as the header."""
    rows = [[_cell(c) for c in r] for r in rows]
    rows = [r for r in rows if any(r)]
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    # Drop columns that are empty in every row (common in spreadsheets and
    # HTML filings that use spacer cells).
    keep = [i for i in range(width) if any(r[i] for r in rows)]
    rows = [[r[i] for i in keep] for r in rows]
    header, *body = rows
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join(r) + " |" for r in body]
    return "\n".join(lines)


def _cell(value: object) -> str:
    if value is None:
        return ""
    text = str(value).replace("\n", " ").replace("|", "\\|")
    return " ".join(text.split())
