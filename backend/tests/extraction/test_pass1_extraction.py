"""Pass 1 — Raw extraction tests (deterministic, no LLM).

Runs extract_raw_slots() on each fixture template and scores
the output against the ground truth schema.

Run: pytest tests/extraction -m pass1 -v
"""

from __future__ import annotations

import pytest

from app.templates.schema_extractor import extract_raw_slots
from tests.extraction.scoring import Pass1Score, print_pass1_report, score_pass1

PASS1_THRESHOLD = 0.80


def _score_all(template_cases) -> list[Pass1Score]:
    scores: list[Pass1Score] = []
    for case in template_cases:
        raw_slots = extract_raw_slots(case.file_bytes)
        score = score_pass1(raw_slots, case.ground_truth, case.name)
        scores.append(score)
    return scores


@pytest.mark.pass1
class TestPass1Extraction:
    def test_extraction_does_not_crash(self, template_cases):
        """Every template file should extract without exceptions."""
        if not template_cases:
            pytest.skip("No fixtures in tests/extraction/fixtures/")
        for case in template_cases:
            slots = extract_raw_slots(case.file_bytes)
            assert isinstance(slots, list), f"{case.name}: expected list"
            assert len(slots) > 0, f"{case.name}: extracted 0 slots"

    def test_field_count(self, template_cases):
        """Extracted slot count should be within 20% of ground truth."""
        if not template_cases:
            pytest.skip("No fixtures")
        for case in template_cases:
            slots = extract_raw_slots(case.file_bytes)
            expected = len(case.ground_truth.fields)
            tolerance = max(3, int(expected * 0.2))
            assert abs(len(slots) - expected) <= tolerance, (
                f"{case.name}: expected ~{expected} slots, got {len(slots)}"
            )

    def test_field_types(self, template_cases):
        """Field type detection accuracy should exceed threshold."""
        if not template_cases:
            pytest.skip("No fixtures")
        scores = _score_all(template_cases)
        print_pass1_report(scores)
        for s in scores:
            assert s.type_accuracy >= PASS1_THRESHOLD, (
                f"{s.template_name}: type accuracy {s.type_accuracy:.1%} "
                f"< {PASS1_THRESHOLD:.0%}"
            )

    def test_context_quality(self, template_cases):
        """Context should contain key terms from the field label."""
        if not template_cases:
            pytest.skip("No fixtures")
        scores = _score_all(template_cases)
        print_pass1_report(scores)
        for s in scores:
            assert s.context_accuracy >= PASS1_THRESHOLD, (
                f"{s.template_name}: context accuracy {s.context_accuracy:.1%} "
                f"< {PASS1_THRESHOLD:.0%}"
            )

    def test_overall_score(self, template_cases):
        """Overall Pass 1 score across all templates."""
        if not template_cases:
            pytest.skip("No fixtures")
        scores = _score_all(template_cases)
        print_pass1_report(scores)
        avg = sum(s.overall for s in scores) / len(scores)
        assert avg >= PASS1_THRESHOLD, (
            f"Average Pass 1 score {avg:.1%} < {PASS1_THRESHOLD:.0%}"
        )
