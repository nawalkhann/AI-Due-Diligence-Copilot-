from __future__ import annotations

import argparse
import json
from pathlib import Path

from .chunking import chunk_document
from .config import get_settings
from .parsing import parse_document
from .runner import configure_logging, run_forever, run_once


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="ddc-worker")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("run", help="process ingestion jobs until stopped")
    sub.add_parser("drain", help="process all queued jobs, then exit")
    inspect = sub.add_parser("inspect", help="parse and chunk a local file, print the result")
    inspect.add_argument("path", type=Path)
    inspect.add_argument("--chunks", action="store_true", help="print every chunk")
    args = parser.parse_args(argv)

    settings = get_settings()
    configure_logging(settings.log_level)

    if args.command == "run":
        run_forever(settings)
    elif args.command == "drain":
        print(json.dumps({"processed": run_once(settings)}))
    elif args.command == "inspect":
        parsed = parse_document(args.path.read_bytes(), args.path.name)
        chunks = chunk_document(parsed, settings.chunk_target_tokens,
                                settings.chunk_max_tokens, settings.chunk_overlap_tokens)
        print(json.dumps({
            "pages": parsed.page_count,
            "chunks": len(chunks),
            "tables": sum(c.chunk_type == "table" for c in chunks),
            "warnings": parsed.warnings,
        }, indent=2))
        if args.chunks:
            for c in chunks:
                print(f"\n--- #{c.index} {c.chunk_type} p{c.page_start}-{c.page_end}"
                      f" [{c.section or '-'}] {c.token_count} tokens")
                print(c.content)


if __name__ == "__main__":
    main()
