import pytest

from ddc_worker.parsing import UnsupportedDocument, parse_document
from ddc_worker.parsing.base import rows_to_markdown


def kinds(page):
    return [b.kind for b in page.blocks]


def test_pdf_headings_tables_and_boilerplate(sample_pdf):
    doc = parse_document(sample_pdf, "report.pdf")
    assert doc.page_count == 4

    first = doc.pages[0]
    assert first.blocks[0].kind == "heading"
    assert first.blocks[0].text == "Item 1A. Risk Factors"
    assert "38% of revenue" in first.text
    # running header and page number are removed from every page
    assert all("Annual Report 2025" not in p.text for p in doc.pages)
    assert all(not b.text.strip().isdigit() for p in doc.pages for b in p.blocks)

    tables = [b for b in doc.pages[1].blocks if b.kind == "table"]
    assert len(tables) == 1
    assert "| Revenue | 1,250 | 1,050 |" in tables[0].text
    # table text is not duplicated as loose paragraphs
    assert not any(b.kind == "text" and "Gross profit" in b.text for b in doc.pages[1].blocks)


def test_pdf_detected_by_content_even_if_misnamed(sample_pdf):
    assert parse_document(sample_pdf, "download.bin").page_count == 4


def test_html_filing_pages_items_and_money_cells(sample_html):
    doc = parse_document(sample_html, "10k.htm")
    assert doc.page_count == 2
    assert doc.pages[0].blocks[0].kind == "heading"
    assert [b.text for b in doc.pages[0].blocks if b.kind == "heading"] == [
        "PART I", "Item 1A. Risk Factors"]
    table = next(b for b in doc.pages[1].blocks if b.kind == "table")
    assert "| Revenue | $1,250 | $1,050 |" in table.text
    assert "$(12)" in table.text


def test_xlsx_sheets_numbers_and_hidden_sheets(sample_xlsx):
    doc = parse_document(sample_xlsx, "model.xlsx")
    assert doc.page_count == 1
    page = doc.pages[0]
    assert page.label == "Income Statement"
    assert "| Revenue | 1,050,000 | 1,250,000 |" in page.text
    assert "210,000.5" in page.text
    assert "secret" not in page.text


def test_pptx_titles_notes_and_chart_data(sample_pptx):
    doc = parse_document(sample_pptx, "deck.pptx")
    assert doc.page_count == 2
    assert doc.pages[0].label == "Investment Highlights"
    assert "40% recurring revenue" in doc.pages[0].text
    assert "net revenue retention of 120%" in doc.pages[0].text
    assert "| Revenue ($m) | 800 | 1,050 | 1,250 |" in doc.pages[1].text


def test_docx_headings_tables_and_page_breaks(sample_docx):
    doc = parse_document(sample_docx, "market.docx")
    assert doc.page_count == 2
    assert doc.pages[0].blocks[0].kind == "heading"
    assert kinds(doc.pages[1]) == ["heading", "table"]
    assert doc.pages[1].blocks[0].level == 2


@pytest.mark.parametrize("data,name", [
    (b"not a pdf", "x.pdf"),
    (b"plain", "x.xlsx"),
    (b"\x00\x01", "x.exe"),
])
def test_rejects_bad_files(data, name):
    with pytest.raises(UnsupportedDocument):
        parse_document(data, name)


def test_rows_to_markdown_drops_empty_columns_and_escapes_pipes():
    md = rows_to_markdown([["A", "", "B"], ["x|y", "", "2"], ["", "", ""]])
    assert md.splitlines() == ["| A | B |", "|---|---|", "| x\\|y | 2 |"]
