"""CLI for running extraction scoring without pytest.

Usage:
    cd backend
    python -m tests.extraction.cli --pass1
    python -m tests.extraction.cli --pass2
    python -m tests.extraction.cli --pass1 --template template_a
    python -m tests.extraction.cli --pass1 --json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import asdict
from pathlib import Path

# Ensure app imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.templates.schema_extractor import extract_raw_slots
from tests.extraction.fixtures_loader import TemplateCase, discover_cases
from tests.extraction.scoring import (
    print_pass1_report,
    print_pass2_report,
    score_pass1,
    score_pass2,
)


def run_pass1(cases: list[TemplateCase], as_json: bool = False) -> None:
    scores = []
    for case in cases:
        raw_slots = extract_raw_slots(case.file_bytes)
        score = score_pass1(raw_slots, case.ground_truth, case.name)
        scores.append(score)

    if as_json:
        print(json.dumps([asdict(s) for s in scores], indent=2))
    else:
        print_pass1_report(scores)


async def run_pass2(cases: list[TemplateCase], as_json: bool = False) -> None:
    from app.templates.schema_labeler import label_slots

    scores = []
    for case in cases:
        raw_slots = extract_raw_slots(case.file_bytes)
        schema = await label_slots(raw_slots, case.ground_truth.template_name)
        score = score_pass2(schema, case.ground_truth, case.name)
        scores.append(score)

    if as_json:
        print(json.dumps([asdict(s) for s in scores], indent=2))
    else:
        print_pass2_report(scores)


def main() -> None:
    parser = argparse.ArgumentParser(description="Extraction scoring CLI")
    parser.add_argument("--pass1", action="store_true", help="Run Pass 1 (raw extraction)")
    parser.add_argument("--pass2", action="store_true", help="Run Pass 2 (LLM labeling)")
    parser.add_argument("--template", type=str, help="Run a single template by name")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    if not args.pass1 and not args.pass2:
        args.pass1 = True  # default to pass1

    cases = discover_cases(template_filter=args.template)
    if not cases:
        print("No fixtures found in tests/extraction/fixtures/", file=sys.stderr)
        print("Drop <name>.docx + <name>_schema.json pairs there.", file=sys.stderr)
        sys.exit(1)

    if args.pass1:
        run_pass1(cases, args.json)

    if args.pass2:
        asyncio.run(run_pass2(cases, args.json))


if __name__ == "__main__":
    main()
