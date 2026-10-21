from __future__ import annotations

from collections.abc import Callable
from pathlib import PurePosixPath

from .base import Block, Page, ParsedDocument, UnsupportedDocument
from .html import parse_html
from .office import parse_csv, parse_docx, parse_pptx, parse_text, parse_xlsx
from .pdf import parse_pdf

__all__ = ["Block", "Page", "ParsedDocument", "UnsupportedDocument", "parse_document"]

_BY_EXTENSION: dict[str, Callable[[bytes], ParsedDocument]] = {
    ".pdf": parse_pdf,
    ".htm": parse_html,
    ".html": parse_html,
    ".xlsx": parse_xlsx,
    ".xlsm": parse_xlsx,
    ".pptx": parse_pptx,
    ".docx": parse_docx,
    ".txt": parse_text,
    ".md": parse_text,
    ".csv": parse_csv,
}


def parse_document(data: bytes, file_name: str) -> ParsedDocument:
    """Pick a parser from the file's content, falling back to its extension.
    Content sniffing matters because uploads are often misnamed."""
    if data[:5] == b"%PDF-":
        return parse_pdf(data)
    ext = PurePosixPath(file_name.lower()).suffix
    parser = _BY_EXTENSION.get(ext)
    if parser is None:
        head = data[:512].lstrip().lower()
        if head.startswith((b"<!doctype html", b"<html", b"<?xml")):
            return parse_html(data)
        raise UnsupportedDocument(f"unsupported file type: {ext or 'unknown'}")
    if parser in (parse_xlsx, parse_pptx, parse_docx) and data[:2] != b"PK":
        raise UnsupportedDocument(f"file is not a valid {ext} file")
    return parser(data)
