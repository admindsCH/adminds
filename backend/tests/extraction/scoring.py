"""Scoring engine for extraction test suite.

Matches extracted slots/fields to ground truth by position,
then scores accuracy across multiple dimensions.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field

from app.templates.schemas import RawSlot, SchemaField, TemplateSchema


# ── Helpers ─────────────────────────────────────────────


def _position_key(position: dict) -> tuple:
    """Convert a position dict to a hashable key for matching."""
    if "ff_index" in position:
        return ("ff", position["ff_index"])
    if "table_index" in position:
        return ("tbl", position["table_index"], position["row"], position["col"])
    if "field_name" in position:
        return ("pdf", position["field_name"])
    if "paragraph_index" in position:
        return ("para", position["paragraph_index"])
    return tuple(sorted(position.items()))


def _normalize(text: str) -> str:
    """Lowercase, strip accents, collapse whitespace."""
    text = text.strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    return " ".join(text.split())


def _tokenize(text: str) -> set[str]:
    """Split normalized text into a set of tokens."""
    return {t for t in _normalize(text).split() if len(t) > 1}


def _token_overlap(a: str, b: str) -> float:
    """Fraction of tokens in *a* that appear in *b*. Returns 0.0-1.0."""
    tokens_a = _tokenize(a)
    tokens_b = _tokenize(b)
    if not tokens_a:
        return 1.0 if not tokens_b else 0.0
    return len(tokens_a & tokens_b) / len(tokens_a)


# ── Pass 1: Raw Extraction Scoring ──────────────────────


@dataclass
class Pass1Score:
    """Accuracy scores for raw slot extraction (no LLM)."""

    template_name: str
    expected_count: int
    actual_count: int
    type_matches: int = 0
    type_total: int = 0
    context_hits: int = 0
    context_total: int = 0
    matched_count: int = 0
    unmatched_expected: list[str] = field(default_factory=list)
    extra_extracted: int = 0

    @property
    def count_accuracy(self) -> float:
        if self.expected_count == 0:
            return 1.0
        return 1.0 - abs(self.expected_count - self.actual_count) / self.expected_count

    @property
    def type_accuracy(self) -> float:
        return self.type_matches / self.type_total if self.type_total else 1.0

    @property
    def context_accuracy(self) -> float:
        return self.context_hits / self.context_total if self.context_total else 1.0

    @property
    def overall(self) -> float:
        return (self.count_accuracy + self.type_accuracy + self.context_accuracy) / 3


def score_pass1(
    raw_slots: list[RawSlot],
    ground_truth: TemplateSchema,
    template_name: str,
) -> Pass1Score:
    """Score raw extraction output against ground truth."""
    gt_by_pos: dict[tuple, SchemaField] = {}
    for f in ground_truth.fields:
        gt_by_pos[_position_key(f.position)] = f

    slot_by_pos: dict[tuple, RawSlot] = {}
    for s in raw_slots:
        slot_by_pos[_position_key(s.position)] = s

    score = Pass1Score(
        template_name=template_name,
        expected_count=len(ground_truth.fields),
        actual_count=len(raw_slots),
    )

    # Match extracted slots to ground truth by position
    for pos_key, gt_field in gt_by_pos.items():
        slot = slot_by_pos.get(pos_key)
        if slot is None:
            score.unmatched_expected.append(gt_field.id)
            continue

        score.matched_count += 1

        # Field type accuracy
        score.type_total += 1
        if slot.detected_field_type == gt_field.field_type:
            score.type_matches += 1

        # Context quality: do key terms from the GT label appear in context?
        score.context_total += 1
        gt_tokens = _tokenize(gt_field.label)
        if gt_tokens:
            context_lower = _normalize(slot.context)
            hits = sum(1 for t in gt_tokens if t in context_lower)
            if hits / len(gt_tokens) >= 0.3:
                score.context_hits += 1
        else:
            score.context_hits += 1

    score.extra_extracted = len(raw_slots) - score.matched_count
    return score


# ── Pass 2: LLM Labeling Scoring ───────────────────────


@dataclass
class Pass2Score:
    """Accuracy scores for LLM-labeled schema fields."""

    template_name: str
    field_count: int = 0
    matched_count: int = 0
    label_matches: int = 0
    section_matches: int = 0
    rubrique_matches: int = 0
    rubrique_total: int = 0

    @property
    def label_accuracy(self) -> float:
        return self.label_matches / self.matched_count if self.matched_count else 0.0

    @property
    def section_accuracy(self) -> float:
        return self.section_matches / self.matched_count if self.matched_count else 0.0

    @property
    def rubrique_accuracy(self) -> float:
        return self.rubrique_matches / self.rubrique_total if self.rubrique_total else 1.0

    @property
    def overall(self) -> float:
        return (self.label_accuracy + self.section_accuracy + self.rubrique_accuracy) / 3


def score_pass2(
    extracted: TemplateSchema,
    ground_truth: TemplateSchema,
    template_name: str,
) -> Pass2Score:
    """Score LLM-labeled schema against ground truth."""
    gt_by_pos: dict[tuple, SchemaField] = {}
    for f in ground_truth.fields:
        gt_by_pos[_position_key(f.position)] = f

    ext_by_pos: dict[tuple, SchemaField] = {}
    for f in extracted.fields:
        ext_by_pos[_position_key(f.position)] = f

    score = Pass2Score(
        template_name=template_name,
        field_count=len(ground_truth.fields),
    )

    for pos_key, gt_field in gt_by_pos.items():
        ext_field = ext_by_pos.get(pos_key)
        if ext_field is None:
            continue

        score.matched_count += 1

        # Label: token overlap >= 0.4 counts as match
        if _token_overlap(gt_field.label, ext_field.label) >= 0.4:
            score.label_matches += 1

        # Section: exact match after normalization
        if _normalize(gt_field.section) == _normalize(ext_field.section):
            score.section_matches += 1

        # mapped_rubrique: exact match (only when GT has one)
        if gt_field.mapped_rubrique:
            score.rubrique_total += 1
            if gt_field.mapped_rubrique == ext_field.mapped_rubrique:
                score.rubrique_matches += 1

    return score


# ── Reporting ───────────────────────────────────────────


def print_pass1_report(scores: list[Pass1Score]) -> None:
    """Print a formatted Pass 1 accuracy table."""
    print()
    print("=" * 80)
    print("PASS 1 — Raw Extraction Scores")
    print("=" * 80)
    print(
        f"{'Template':<30} {'Count':>10} {'Types':>10} {'Context':>10} {'Overall':>10}"
    )
    print("-" * 80)
    for s in scores:
        count_str = f"{s.actual_count}/{s.expected_count}"
        print(
            f"{s.template_name:<30} {count_str:>10} "
            f"{s.type_accuracy:>9.1%} {s.context_accuracy:>9.1%} "
            f"{s.overall:>9.1%}"
        )
        if s.unmatched_expected:
            print(f"  Missing: {', '.join(s.unmatched_expected[:5])}")
            if len(s.unmatched_expected) > 5:
                print(f"  ... and {len(s.unmatched_expected) - 5} more")
    print("-" * 80)
    if scores:
        avg = sum(s.overall for s in scores) / len(scores)
        print(f"{'AVERAGE':<30} {'':>10} {'':>10} {'':>10} {avg:>9.1%}")
    print("=" * 80)
    print()


def print_pass2_report(scores: list[Pass2Score]) -> None:
    """Print a formatted Pass 2 accuracy table."""
    print()
    print("=" * 80)
    print("PASS 2 — LLM Labeling Scores")
    print("=" * 80)
    print(
        f"{'Template':<30} {'Labels':>10} {'Sections':>10} "
        f"{'Rubriques':>10} {'Overall':>10}"
    )
    print("-" * 80)
    for s in scores:
        print(
            f"{s.template_name:<30} {s.label_accuracy:>9.1%} "
            f"{s.section_accuracy:>9.1%} {s.rubrique_accuracy:>9.1%} "
            f"{s.overall:>9.1%}"
        )
    print("-" * 80)
    if scores:
        avg = sum(s.overall for s in scores) / len(scores)
        print(f"{'AVERAGE':<30} {'':>10} {'':>10} {'':>10} {avg:>9.1%}")
    print("=" * 80)
    print()
