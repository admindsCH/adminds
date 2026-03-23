"""
Geneva canton AI report (.docx) field map.

The Geneva template is simpler than Fribourg: a header table with 4 form
fields, then 14 single-cell answer boxes (one per question), plus date,
signature, and annexe boxes at the end.

Two kinds of targets:

1. **Form fields** (fldChar-based) — 4 fields in the header table:
   patient name, DOB, AVS number, doctor name.

2. **Table cells** — single-cell answer tables (tables 1–14) plus
   date (table 15), signature (table 16), annexe (table 17).
"""

from __future__ import annotations
from dataclasses import dataclass
from enum import Enum


class FieldType(str, Enum):
    TEXT = "text"
    DATE = "date"


@dataclass
class FormField:
    """A fldChar-based form field in the header."""

    id: str
    ff_index: int
    field_type: FieldType
    label: str
    section: str
    hint: str = ""


@dataclass
class TableCell:
    """A single-cell answer table identified by table index."""

    id: str
    table_index: int
    row: int
    col: int
    field_type: FieldType
    label: str
    section: str
    hint: str = ""


# ── Header form fields (table 0) ───────────────────────────

HEADER_FIELDS: list[FormField] = [
    FormField(
        id="patient_nom",
        ff_index=0,
        field_type=FieldType.TEXT,
        label="Personne assurée (prénom, nom)",
        section="header",
    ),
    FormField(
        id="patient_date_naissance",
        ff_index=1,
        field_type=FieldType.DATE,
        label="Date de naissance",
        section="header",
    ),
    FormField(
        id="patient_avs",
        ff_index=2,
        field_type=FieldType.TEXT,
        label="Numéro d'assuré (après 756.)",
        section="header",
        hint="Format: XXXX.XXXX.XX (sans le préfixe 756.)",
    ),
    FormField(
        id="medecin_nom",
        ff_index=3,
        field_type=FieldType.TEXT,
        label="Médecin spécialiste (prénom, nom)",
        section="header",
    ),
]

# ── Answer tables (tables 1–14) ────────────────────────────
# Each is a single-cell table (row=0, col=0) that receives free text.

ANSWER_FIELDS: list[TableCell] = [
    TableCell(
        id="q01_anamnese_status",
        table_index=1,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="1. Anamnèse et status (constatations objectives)",
        section="anamnese",
        hint="Anamnèse détaillée et status médical objectif",
    ),
    TableCell(
        id="q02_diagnostics_avec_repercussion",
        table_index=2,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="2. Diagnostic(s) avec répercussion durable sur la capacité de travail",
        section="diagnostics",
        hint="Codes CIM avec descriptions. Un par ligne.",
    ),
    TableCell(
        id="q03_diagnostics_sans_repercussion",
        table_index=3,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="3. Diagnostic(s) sans répercussion durable sur la capacité de travail",
        section="diagnostics",
        hint="Codes CIM avec descriptions, ou 'Néant'",
    ),
    TableCell(
        id="q04_suivi_traitement",
        table_index=4,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="4. Suivi médical, traitement et propositions thérapeutiques",
        section="traitement",
        hint="Date 1ère consultation, fréquence suivi, médicaments + posologie, propositions futures",
    ),
    TableCell(
        id="q05_observance",
        table_index=5,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="5. Observance thérapeutique et compliance",
        section="traitement",
        hint="Observance des psychotropes, résultats monitorings sanguins. Si non-compliance, effet potentiel du traitement.",
    ),
    TableCell(
        id="q06_evolution",
        table_index=6,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="6. Évolution de l'état de santé depuis la prise en charge",
        section="evolution",
        hint="Stationnaire, amélioration ou péjoration ? Détailler.",
    ),
    TableCell(
        id="q07_pronostic",
        table_index=7,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="7. Pronostic",
        section="pronostic",
    ),
    TableCell(
        id="q08_limitations_fonctionnelles",
        table_index=8,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="8. Limitations fonctionnelles découlant du(des) diagnostic(s) incapacitant(s)",
        section="limitations",
    ),
    TableCell(
        id="q09_repercussions_vie_quotidienne",
        table_index=9,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="9. Répercussions dans les activités courantes de la vie et journée type",
        section="vie_quotidienne",
        hint="Ménage, loisirs, activités sociales. Déroulement d'une journée type.",
    ),
    TableCell(
        id="q10_ressources",
        table_index=10,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="10. Ressources disponibles ou mobilisables",
        section="ressources",
        hint="Réseau social, aptitude à la collaboration, loisirs, etc.",
    ),
    TableCell(
        id="q11_readaptation",
        table_index=11,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="11. Aptitude à suivre une mesure de réadaptation professionnelle",
        section="readaptation",
        hint="Si oui, type de mesure. Si non, pourquoi.",
    ),
    TableCell(
        id="q12_capacite_activite_habituelle",
        table_index=12,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="12. Capacité de travail dans l'activité habituelle",
        section="capacite_travail",
        hint="Préciser l'activité. Taux et depuis quand. Si 0%, reprise envisageable ? Quand ?",
    ),
    TableCell(
        id="q13_capacite_activite_adaptee",
        table_index=13,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="13. Capacité de travail dans une activité adaptée",
        section="capacite_travail",
        hint="Taux et depuis quand. Si 0%, raisons et reprise envisageable ?",
    ),
    TableCell(
        id="q14_remarques",
        table_index=14,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="14. Remarques éventuelles",
        section="remarques",
        hint="Informations complémentaires ou 'Néant'",
    ),
]

# ── Closing fields (date, signature, annexe) ───────────────

CLOSING_FIELDS: list[TableCell] = [
    TableCell(
        id="date_signature",
        table_index=15,
        row=0,
        col=0,
        field_type=FieldType.DATE,
        label="Date",
        section="signature",
    ),
    TableCell(
        id="signature_medecin",
        table_index=16,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="Prénom, nom et signature du médecin",
        section="signature",
    ),
    TableCell(
        id="annexes",
        table_index=17,
        row=0,
        col=0,
        field_type=FieldType.TEXT,
        label="Annexes",
        section="signature",
        hint="Liste des annexes jointes, ou 'Rien à signaler'",
    ),
]

# ── Aggregates ──────────────────────────────────────────────

ALL_FORM_FIELDS: list[FormField] = HEADER_FIELDS

ALL_TABLE_CELLS: list[TableCell] = ANSWER_FIELDS + CLOSING_FIELDS


def get_ai_prompt_schema() -> list[dict]:
    """Return field descriptors for AI prompt inclusion."""
    schema = []
    for f in ALL_FORM_FIELDS:
        entry = {
            "id": f.id,
            "type": f.field_type.value,
            "label": f.label,
            "section": f.section,
        }
        if f.hint:
            entry["hint"] = f.hint
        schema.append(entry)
    for tc in ALL_TABLE_CELLS:
        entry = {
            "id": tc.id,
            "type": tc.field_type.value,
            "label": tc.label,
            "section": tc.section,
        }
        if tc.hint:
            entry["hint"] = tc.hint
        schema.append(entry)
    return schema
