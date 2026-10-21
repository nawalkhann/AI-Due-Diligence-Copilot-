from ddc_worker.chunking import chunk_document, estimate_tokens
from ddc_worker.parsing.base import Block, Page, ParsedDocument


def doc(*pages):
    return ParsedDocument(pages=[Page(number=i + 1, blocks=list(b)) for i, b in enumerate(pages)])


def test_chunks_do_not_cross_headings_and_track_sections():
    parsed = doc([
        Block("heading", "Item 1A. Risk Factors", 1),
        Block("heading", "Customer concentration", 2),
        Block("text", "Two customers are 38% of revenue."),
        Block("heading", "Item 7. MD&A", 1),
        Block("text", "Revenue grew 19%."),
    ])
    chunks = chunk_document(parsed)
    assert [c.section for c in chunks] == [
        "Item 1A. Risk Factors > Customer concentration", "Item 7. MD&A"]
    assert [c.index for c in chunks] == [0, 1]


def test_text_spanning_pages_records_page_range():
    sentence = "Revenue increased because of strong demand in Europe. "
    parsed = doc([Block("text", sentence * 20)], [Block("text", sentence * 20)])
    chunks = chunk_document(parsed, target_tokens=400, max_tokens=800)
    assert chunks[0].page_start == 1
    assert any(c.page_end == 2 for c in chunks)


def test_long_text_respects_max_tokens_with_overlap():
    para = " ".join(f"Sentence number {i} describes a risk." for i in range(400))
    chunks = chunk_document(doc([Block("text", para)]), target_tokens=200, max_tokens=300,
                            overlap_tokens=40)
    assert len(chunks) > 5
    assert all(c.token_count <= 300 for c in chunks)
    # consecutive chunks share some text
    first_tail = chunks[0].content.split()[-4:]
    assert " ".join(first_tail) in chunks[1].content


def test_large_tables_split_by_rows_with_header_repeated():
    rows = "\n".join(f"| Item {i} | {i * 100} |" for i in range(300))
    table = "| Line | Value |\n|---|---|\n" + rows
    parsed = doc([Block("text", "Segment revenue"), Block("table", table)])
    chunks = chunk_document(parsed, max_tokens=300)
    tables = [c for c in chunks if c.chunk_type == "table"]
    assert len(tables) > 1
    for c in tables:
        assert c.content.startswith("Segment revenue\n\n| Line | Value |\n|---|---|")
        assert c.token_count <= 300 + estimate_tokens("Segment revenue")
        assert c.metadata["table_parts"] == len(tables)
    # every row appears exactly once
    body = "\n".join(c.content for c in tables)
    assert all(body.count(f"| Item {i} |") == 1 for i in range(300))


def test_empty_document_has_no_chunks():
    assert chunk_document(doc([Block("text", "   ")])) == []
