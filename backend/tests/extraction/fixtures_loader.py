"""Fixture discovery — shared between conftest.py and cli.py.

No pytest dependency so the CLI can import this standalone.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from app.templates.schemas import TemplateSchema

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@dataclass
class TemplateCase:
    """A template file paired with its ground truth schema."""

    name: str
    file_bytes: bytes
    ground_truth: TemplateSchema


def discover_cases(template_filter: str | None = None) -> list[TemplateCase]:
    """Find all *_schema.json files and pair with their template files."""
    cases: list[TemplateCase] = []
    for schema_path in sorted(FIXTURES_DIR.glob("*_schema.json")):
        prefix = schema_path.name.replace("_schema.json", "")
        if template_filter and prefix != template_filter:
            continue
        # Find matching template file (.docx or .pdf)
        template_path = None
        for ext in (".docx", ".pdf"):
            candidate = FIXTURES_DIR / f"{prefix}{ext}"
            if candidate.exists():
                template_path = candidate
                break
        if template_path is None:
            continue

        gt_data = json.loads(schema_path.read_text(encoding="utf-8"))
        gt_schema = TemplateSchema.model_validate(gt_data)

        cases.append(
            TemplateCase(
                name=prefix,
                file_bytes=template_path.read_bytes(),
                ground_truth=gt_schema,
            )
        )
    return cases
