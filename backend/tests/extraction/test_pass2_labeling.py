"""Pass 2 — LLM labeling tests (expensive, non-deterministic).

Runs extract_raw_slots() + label_slots() on each fixture template
and scores the labeled schema against ground truth.

Run: pytest tests/extraction -m pass2 -v
Skip: pytest tests/extraction -m "not pass2"
"""

from __future__ import annotations

import pytest

from app.templates.schema_extractor import extract_raw_slots
from app.templates.schema_labeler import label_slots
from tests.extraction.scoring import Pass2Score, print_pass2_report, score_pass2

PASS2_THRESHOLD = 0.70


async def _score_all(template_cases) -> list[Pass2Score]:
    scores: list[Pass2Score] = []
    for case in template_cases:
        raw_slots = extract_raw_slots(case.file_bytes)
        schema = await label_slots(raw_slots, case.ground_truth.template_name)
        score = score_pass2(schema, case.ground_truth, case.name)
        scores.append(score)
    return scores


@pytest.mark.pass2
class TestPass2Labeling:
    @pytest.mark.asyncio
    async def test_labeling_produces_valid_schema(self, template_cases):
        """LLM labeling should return a valid schema for every template."""
        if not template_cases:
            pytest.skip("No fixtures")
        for case in template_cases:
            raw_slots = extract_raw_slots(case.file_bytes)
            schema = await label_slots(raw_slots, case.ground_truth.template_name)
            assert len(schema.fields) == len(raw_slots), (
                f"{case.name}: labeler returned {len(schema.fields)} fields "
                f"for {len(raw_slots)} slots"
            )
            assert all(f.id for f in schema.fields), (
                f"{case.name}: some fields have empty IDs"
            )

    @pytest.mark.asyncio
    async def test_section_accuracy(self, template_cases):
        """Section assignment accuracy should exceed threshold."""
        if not template_cases:
            pytest.skip("No fixtures")
        scores = await _score_all(template_cases)
        print_pass2_report(scores)
        for s in scores:
            assert s.section_accuracy >= PASS2_THRESHOLD, (
                f"{s.template_name}: section accuracy {s.section_accuracy:.1%} "
                f"< {PASS2_THRESHOLD:.0%}"
            )

    @pytest.mark.asyncio
    async def test_rubrique_accuracy(self, template_cases):
        """mapped_rubrique accuracy should exceed threshold."""
        if not template_cases:
            pytest.skip("No fixtures")
        scores = await _score_all(template_cases)
        print_pass2_report(scores)
        for s in scores:
            assert s.rubrique_accuracy >= PASS2_THRESHOLD, (
                f"{s.template_name}: rubrique accuracy {s.rubrique_accuracy:.1%} "
                f"< {PASS2_THRESHOLD:.0%}"
            )

    @pytest.mark.asyncio
    async def test_overall_score(self, template_cases):
        """Overall Pass 2 score across all templates."""
        if not template_cases:
            pytest.skip("No fixtures")
        scores = await _score_all(template_cases)
        print_pass2_report(scores)
        avg = sum(s.overall for s in scores) / len(scores)
        assert avg >= PASS2_THRESHOLD, (
            f"Average Pass 2 score {avg:.1%} < {PASS2_THRESHOLD:.0%}"
        )
