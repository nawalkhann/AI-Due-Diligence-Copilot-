from __future__ import annotations

import re

from bs4 import BeautifulSoup, NavigableString, Tag

from .base import Block, Page, ParsedDocument, UnsupportedDocument, rows_to_markdown

_PAGE_BREAK = re.compile(r"page-break-(before|after)\s*:\s*always", re.I)
_HEADINGS = {"h1": 1, "h2": 1, "h3": 2, "h4": 2, "h5": 3, "h6": 3}
_BLOCK_TAGS = {"p", "div", "li", "td", "th", "tr", "br", "section", "article", "blockquote"}
_SKIP_TAGS = {"script", "style", "noscript", "head", "title", "meta"}
# SEC filings mark section starts like "Item 1A. Risk Factors" in bold text
# rather than heading tags.
_ITEM_HEADING = re.compile(r"^(part\s+[ivx]+|item\s+\d+[a-z]?)\b([.:\s]|$)", re.I)


def parse_html(data: bytes) -> ParsedDocument:
    try:
        soup = BeautifulSoup(data, "lxml")
    except Exception as exc:
        raise UnsupportedDocument(f"not readable HTML: {exc}") from exc

    # Inline XBRL filings hide machine-readable facts in ix:header; drop it.
    for hidden in soup.find_all(["ix:header"]):
        hidden.decompose()
    for tag in soup.find_all(_SKIP_TAGS):
        tag.decompose()

    root = soup.body or soup
    walker = _Walker()
    walker.walk(root)
    walker.flush_text()

    pages = [p for p in walker.pages if p.blocks]
    for i, page in enumerate(pages, start=1):
        page.number = i
    if not pages:
        raise UnsupportedDocument("HTML contains no readable text")

    warnings = []
    if len(pages) == 1 and len(pages[0].text) > 60_000:
        warnings.append("no page breaks found; citations will point to page 1")
    return ParsedDocument(pages=pages, warnings=warnings)


class _Walker:
    def __init__(self) -> None:
        self.pages: list[Page] = [Page(number=1)]
        self.buffer: list[str] = []

    @property
    def page(self) -> Page:
        return self.pages[-1]

    def new_page(self) -> None:
        self.flush_text()
        if self.page.blocks:
            self.pages.append(Page(number=len(self.pages) + 1))

    def flush_text(self) -> None:
        text = " ".join(" ".join(self.buffer).split())
        self.buffer = []
        if not text:
            return
        if _ITEM_HEADING.match(text) and len(text) < 150:
            self.page.blocks.append(Block("heading", text, level=1))
        else:
            self.page.blocks.append(Block("text", text))

    def walk(self, node: Tag) -> None:
        for child in node.children:
            if isinstance(child, NavigableString):
                if child.strip():
                    self.buffer.append(str(child))
                continue
            if not isinstance(child, Tag):
                continue

            style = child.get("style", "") or ""
            breaks = _PAGE_BREAK.findall(style)
            if any(b.lower() == "before" for b in breaks):
                self.new_page()

            name = child.name.lower()
            if name == "hr" and "page-break" in style.lower():
                self.new_page()
            elif name in _HEADINGS:
                self.flush_text()
                text = " ".join(child.get_text(" ").split())
                if text:
                    self.page.blocks.append(Block("heading", text, level=_HEADINGS[name]))
            elif name == "table":
                self.flush_text()
                self.add_table(child)
            elif name in _BLOCK_TAGS:
                self.flush_text()
                self.walk(child)
                self.flush_text()
            else:
                self.walk(child)

            if any(b.lower() == "after" for b in breaks):
                self.new_page()

    def add_table(self, table: Tag) -> None:
        rows = []
        for tr in table.find_all("tr"):
            if tr.find_parent("table") is not table:
                continue  # nested tables are rendered as text of their cell
            cells = []
            for cell in tr.find_all(["td", "th"], recursive=False):
                text = " ".join(cell.get_text(" ").split())
                cells.append(text)
                # repeat colspan cells as blanks to keep columns aligned
                colspan = str(cell.get("colspan", "1"))
                span = int(colspan) if colspan.isdigit() else 1
                cells.extend([""] * (span - 1))
            rows.append(_merge_financial_cells(cells))
        filled = [r for r in rows if any(c for c in r)]
        if not filled:
            return
        # Single-cell "tables" are layout wrappers in many filings.
        if all(sum(1 for c in r if c) <= 1 for r in filled):
            for r in filled:
                text = next((c for c in r if c), "")
                self.buffer.append(text)
                self.flush_text()
            return
        markdown = rows_to_markdown(filled)
        if markdown:
            self.page.blocks.append(Block("table", markdown))


def _merge_financial_cells(cells: list[str]) -> list[str]:
    """EDGAR tables split '$', the number, and ')' or '%' into separate cells.
    Glue them back together so '$ | 1,234 | )' reads as '$1,234)'."""
    out: list[str] = []
    for cell in cells:
        if not cell:
            out.append(cell)
        elif cell in {")", "%", ")%"} and out:
            # attach to the last non-empty cell
            for i in range(len(out) - 1, -1, -1):
                if out[i]:
                    out[i] += cell
                    break
            out.append("")
        elif out and _last_filled(out) in {"$", "($", "("}:
            i = max(i for i, c in enumerate(out) if c)
            out[i] += cell
            out.append("")
        else:
            out.append(cell)
    return out


def _last_filled(cells: list[str]) -> str:
    return next((c for c in reversed(cells) if c), "")
