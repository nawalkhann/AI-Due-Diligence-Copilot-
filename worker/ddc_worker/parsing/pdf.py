from __future__ import annotations

import logging
import re
import shutil
import statistics
from collections import Counter

import pymupdf

from .base import Block, Page, ParsedDocument, UnsupportedDocument, rows_to_markdown

log = logging.getLogger(__name__)

_DIGITS = re.compile(r"\d+")


def parse_pdf(data: bytes) -> ParsedDocument:
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:  # pymupdf raises a variety of types
        raise UnsupportedDocument(f"not a readable PDF: {exc}") from exc
    if doc.needs_pass:
        raise UnsupportedDocument("PDF is password protected")

    warnings: list[str] = []
    ocr_available = shutil.which("tesseract") is not None
    raw_pages = [_extract_page(page, ocr_available, warnings) for page in doc]
    doc.close()

    body_size = _body_font_size(raw_pages)
    boilerplate = _repeated_edge_lines(raw_pages)

    pages = []
    for number, items in enumerate(raw_pages, start=1):
        blocks: list[Block] = []
        for i, item in enumerate(items):
            if item["kind"] == "table":
                blocks.append(Block("table", item["text"]))
                continue
            is_edge = i == 0 or i == len(items) - 1
            if is_edge and _normalise(item["text"]) in boilerplate:
                continue
            if _looks_like_heading(item, body_size):
                level = 1 if item["size"] >= body_size * 1.6 else 2
                blocks.append(Block("heading", item["text"], level=level))
            else:
                blocks.append(Block("text", item["text"]))
        pages.append(Page(number=number, blocks=blocks))
    return ParsedDocument(pages=pages, warnings=warnings)


def _extract_page(page: pymupdf.Page, ocr_available: bool, warnings: list[str]) -> list[dict]:
    items: list[dict] = []
    table_rects: list[pymupdf.Rect] = []

    try:
        tables = page.find_tables()
        for table in tables.tables:
            markdown = rows_to_markdown(_table_rows(page, table))
            if markdown:
                rect = pymupdf.Rect(table.bbox)
                table_rects.append(rect)
                items.append({"kind": "table", "text": markdown, "y": rect.y0})
    except Exception:  # table detection is best effort
        log.warning("table detection failed on page %s", page.number + 1, exc_info=True)

    textpage = None
    if not page.get_text("text").strip():
        if ocr_available:
            try:
                textpage = page.get_textpage_ocr(full=True)
            except Exception:
                log.warning("OCR failed on page %s", page.number + 1, exc_info=True)
        if textpage is None and not items:
            warnings.append(f"page {page.number + 1} has no extractable text (scanned image?)")
            return items

    content = page.get_text("dict", sort=True, textpage=textpage)
    for block in content.get("blocks", []):
        if block.get("type") != 0:
            continue
        rect = pymupdf.Rect(block["bbox"])
        if any(_overlap(rect, t) > 0.5 for t in table_rects):
            continue
        lines, sizes, bold = [], [], True
        for line in block.get("lines", []):
            spans = [s for s in line.get("spans", []) if s["text"].strip()]
            if not spans:
                continue
            lines.append("".join(s["text"] for s in line["spans"]).strip())
            for s in spans:
                sizes.append(s["size"])
                bold = bold and bool(s["flags"] & 16)
        text = _join_lines(lines)
        if text:
            items.append({
                "kind": "text",
                "text": text,
                "y": rect.y0,
                "size": max(sizes),
                "bold": bold,
                "lines": len(lines),
            })

    items.sort(key=lambda it: it["y"])
    return items


def _table_rows(page: pymupdf.Page, table) -> list[list[str]]:
    """Read each cell's text from its own region. This keeps word spacing and
    number formatting intact more reliably than the table's own extraction."""
    rows = []
    for row in table.rows:
        cells = []
        for bbox in row.cells:
            if bbox is None:  # merged cell
                cells.append("")
                continue
            text = page.get_text("text", clip=pymupdf.Rect(bbox))
            cells.append(" ".join(text.split()))
        rows.append(cells)
    return rows


def _join_lines(lines: list[str]) -> str:
    """Join visual lines into a paragraph, repairing words hyphenated across lines."""
    out = ""
    for line in lines:
        if not out:
            out = line
        elif out.endswith("-") and line[:1].islower():
            out = out[:-1] + line
        else:
            out += " " + line
    return " ".join(out.split())


def _overlap(a: pymupdf.Rect, b: pymupdf.Rect) -> float:
    inter = a & b
    if inter.is_empty or a.is_empty:
        return 0.0
    return inter.get_area() / a.get_area()


def _body_font_size(pages: list[list[dict]]) -> float:
    sizes: list[float] = []
    for items in pages:
        for it in items:
            if it["kind"] == "text":
                # weight by length so body paragraphs dominate
                sizes.extend([round(it["size"], 1)] * max(1, len(it["text"]) // 50))
    return statistics.median(sizes) if sizes else 10.0


def _looks_like_heading(item: dict, body_size: float) -> bool:
    text = item["text"]
    if len(text) > 150 or item["lines"] > 3 or text.endswith((".", ",", ";")):
        return False
    if item["size"] >= body_size * 1.2:
        return True
    return item["bold"] and len(text) < 100 and item["size"] >= body_size


def _normalise(text: str) -> str:
    return _DIGITS.sub("#", text.lower()).strip()


def _repeated_edge_lines(pages: list[list[dict]]) -> set[str]:
    """Running headers, footers and page numbers repeat at the top or bottom of
    most pages. They add noise to retrieval, so they are dropped."""
    if len(pages) < 3:
        return set()
    counts: Counter[str] = Counter()
    for items in pages:
        texts = [it for it in items if it["kind"] == "text"]
        edges = {_normalise(it["text"]) for it in texts[:1] + texts[-1:]}
        counts.update(e for e in edges if len(e) < 120)
    threshold = max(3, int(len(pages) * 0.5))
    return {text for text, n in counts.items() if n >= threshold}
