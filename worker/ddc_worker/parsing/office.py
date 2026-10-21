from __future__ import annotations

import io
import zipfile

from .base import Block, Page, ParsedDocument, UnsupportedDocument, rows_to_markdown

# Rows per table block for spreadsheets. Large sheets are split so that each
# block stays small enough to embed and cite; the header row is repeated.
_SHEET_ROWS_PER_BLOCK = 40


def parse_xlsx(data: bytes) -> ParsedDocument:
    from openpyxl import load_workbook

    try:
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except (zipfile.BadZipFile, KeyError, OSError) as exc:
        raise UnsupportedDocument(f"not a readable Excel workbook: {exc}") from exc

    pages, warnings = [], []
    for sheet in wb.worksheets:
        if sheet.sheet_state != "visible":
            continue
        rows = [
            ["" if v is None else _format_number(v) for v in row]
            for row in sheet.iter_rows(values_only=True)
        ]
        rows = [r for r in rows if any(str(c).strip() for c in r)]
        if not rows:
            continue
        page = Page(number=len(pages) + 1, label=sheet.title)
        page.blocks.append(Block("heading", f"Sheet: {sheet.title}", level=1))
        header, body = rows[0], rows[1:]
        if not body:
            body, header = [header], [""] * len(header)
        for start in range(0, len(body), _SHEET_ROWS_PER_BLOCK):
            md = rows_to_markdown([header] + body[start:start + _SHEET_ROWS_PER_BLOCK])
            if md:
                page.blocks.append(Block("table", md))
        pages.append(page)
    wb.close()

    if not pages:
        raise UnsupportedDocument("workbook has no visible data")
    warnings.append("formula values come from the last time the file was saved in Excel")
    return ParsedDocument(pages=pages, warnings=warnings)


def _format_number(value: object) -> str:
    if isinstance(value, float):
        if value.is_integer():
            return f"{int(value):,}"
        return f"{value:,.4f}".rstrip("0").rstrip(".")
    if isinstance(value, int) and not isinstance(value, bool):
        return f"{value:,}"
    if hasattr(value, "isoformat"):
        return value.isoformat()[:10]
    return str(value)


def parse_pptx(data: bytes) -> ParsedDocument:
    from pptx import Presentation
    from pptx.util import Emu

    try:
        prs = Presentation(io.BytesIO(data))
    except (zipfile.BadZipFile, KeyError, ValueError) as exc:
        raise UnsupportedDocument(f"not a readable PowerPoint file: {exc}") from exc

    pages = []
    for number, slide in enumerate(prs.slides, start=1):
        page = Page(number=number)
        title_shape = slide.shapes.title
        if title_shape is not None and title_shape.text_frame.text.strip():
            page.label = title_shape.text_frame.text.strip()
            page.blocks.append(Block("heading", page.label, level=1))

        # Reading order: top to bottom, then left to right.
        shapes = sorted(
            (s for s in _iter_shapes(slide.shapes) if s is not title_shape),
            key=lambda s: (Emu(s.top or 0), Emu(s.left or 0)),
        )
        for shape in shapes:
            if getattr(shape, "has_table", False):
                rows = [[c.text for c in row.cells] for row in shape.table.rows]
                md = rows_to_markdown(rows)
                if md:
                    page.blocks.append(Block("table", md))
            elif getattr(shape, "has_chart", False):
                page.blocks.append(Block("table", _chart_to_markdown(shape.chart)))
            elif getattr(shape, "has_text_frame", False):
                text = "\n".join(
                    p.text.strip() for p in shape.text_frame.paragraphs if p.text.strip()
                )
                if text:
                    page.blocks.append(Block("text", text))

        if slide.has_notes_slide:
            notes = slide.notes_slide.notes_text_frame.text.strip()
            if notes:
                page.blocks.append(Block("text", f"Speaker notes: {notes}"))
        pages.append(page)

    warnings = []
    empty = [p.number for p in pages if not p.blocks]
    if empty:
        warnings.append(
            f"{len(empty)} slide(s) contain only images and were not read: "
            + ", ".join(map(str, empty[:20]))
        )
    if not any(p.blocks for p in pages):
        raise UnsupportedDocument("presentation has no readable text")
    return ParsedDocument(pages=pages, warnings=warnings)


def _iter_shapes(shapes):
    for shape in shapes:
        if shape.shape_type == 6:  # group
            yield from _iter_shapes(shape.shapes)
        else:
            yield shape


def _chart_to_markdown(chart) -> str:
    """Charts in investor decks often carry the key numbers; keep their data."""
    try:
        plot = chart.plots[0]
        categories = [str(c) for c in plot.categories]
        rows = [["Series"] + categories]
        for series in plot.series:
            rows.append([series.name or ""] + [_format_number(v) for v in series.values])
        title = chart.chart_title.text_frame.text if chart.has_title else "Chart"
        return f"{title}\n\n{rows_to_markdown(rows)}"
    except Exception:
        return "Chart (data not readable)"


def parse_docx(data: bytes) -> ParsedDocument:
    from docx import Document
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    try:
        document = Document(io.BytesIO(data))
    except (zipfile.BadZipFile, KeyError, ValueError) as exc:
        raise UnsupportedDocument(f"not a readable Word document: {exc}") from exc

    # Word files have no fixed pages. Explicit page breaks are honoured;
    # otherwise everything is page 1 and citations rely on section headings.
    pages = [Page(number=1)]
    body = document.element.body
    for child in body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            para = Paragraph(child, document)
            xml = child.xml
            has_break = 'w:type="page"' in xml or "lastRenderedPageBreak" in xml
            if has_break and pages[-1].blocks:
                pages.append(Page(number=len(pages) + 1))
            text = para.text.strip()
            if not text:
                continue
            style = (para.style.name or "").lower() if para.style is not None else ""
            if style.startswith("heading") or style == "title":
                digits = "".join(ch for ch in style if ch.isdigit())
                level = min(int(digits), 3) if digits else 1
                pages[-1].blocks.append(Block("heading", text, level=level))
            else:
                pages[-1].blocks.append(Block("text", text))
        elif tag == "tbl":
            table = Table(child, document)
            rows = [[cell.text for cell in row.cells] for row in table.rows]
            md = rows_to_markdown(rows)
            if md:
                pages[-1].blocks.append(Block("table", md))

    pages = [p for p in pages if p.blocks]
    if not pages:
        raise UnsupportedDocument("document has no readable text")
    for i, p in enumerate(pages, start=1):
        p.number = i
    return ParsedDocument(pages=pages)


def parse_text(data: bytes) -> ParsedDocument:
    text = data.decode("utf-8", errors="replace")
    page = Page(number=1)
    for para in (p.strip() for p in text.split("\n\n")):
        if not para:
            continue
        if para.startswith("#"):
            level = min(len(para) - len(para.lstrip("#")), 3)
            page.blocks.append(Block("heading", para.lstrip("# ").strip(), level=level))
        else:
            page.blocks.append(Block("text", " ".join(para.split())))
    if not page.blocks:
        raise UnsupportedDocument("file is empty")
    return ParsedDocument(pages=[page])


def parse_csv(data: bytes) -> ParsedDocument:
    import csv

    text = data.decode("utf-8-sig", errors="replace")
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        raise UnsupportedDocument("file is empty")
    page = Page(number=1)
    header, body = rows[0], rows[1:]
    for start in range(0, max(len(body), 1), _SHEET_ROWS_PER_BLOCK):
        md = rows_to_markdown([header] + body[start:start + _SHEET_ROWS_PER_BLOCK])
        if md:
            page.blocks.append(Block("table", md))
    return ParsedDocument(pages=[page])
