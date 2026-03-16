"""
Fribourg canton AI report (.docx) field map.

This module defines every fillable location in the Fribourg template
(frontend/public/templates/fribourg.docx) so that an AI-generated JSON
can be mapped programmatically to the correct Word XML positions.

Two kinds of targets exist:

1. **Form fields** (fldChar-based) — identified by their index in the
   document's linear list of <w:ffData> elements.  Filled by replacing
   the text run between the "separate" and "end" fldChar markers.

2. **Table cells** — identified by (table_index, row, col).  These are
   plain empty cells in grid tables (sections A–D).  Filled by inserting
   a <w:r><w:t> run into the cell's first paragraph.

3. **Header labels** — static table cells whose label text is replaced
   with a value (e.g. "Nom et prénom du médecin" → actual doctor name).
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Literal


# ── Value types ─────────────────────────────────────────────
# Each field expects one of these value shapes from the AI output.


class FieldType(str, Enum):
    TEXT = "text"  # Free text (single or multi-line)
    DATE = "date"  # DD.MM.YYYY
    CHECKBOX = "checkbox"  # true / false
    SELECT_ONE = "select_one"  # Bold/underline the selected option among siblings
    CHOICE = "choice"  # "X" in the matching column (Oui/Non/etc.)


# ── Field descriptors ───────────────────────────────────────


@dataclass
class FormField:
    """A fldChar-based form field in the docx."""

    id: str  # Unique key used in the AI JSON
    ff_index: int  # Index in document's ffData list
    field_type: FieldType
    label: str  # Human-readable label (for prompt)
    section: str  # Report section name
    hint: str = ""  # Extra context for the AI
    options: list[str] = field(default_factory=list)  # For select_one


@dataclass
class TableCell:
    """A plain table cell identified by position."""

    id: str
    table_index: int  # Index in document's table list
    row: int  # 0-based row
    col: int  # 0-based column
    field_type: FieldType
    label: str
    section: str
    hint: str = ""


@dataclass
class HeaderLabel:
    """A table cell whose label text gets replaced with a value."""

    id: str
    table_index: int
    row: int
    col: int
    original_text: str  # Text to find/replace
    label: str
    section: str


# ── Complete Fribourg field map ─────────────────────────────

# ---------- Section: Header / metadata ----------

HEADER_FIELDS: list[HeaderLabel] = [
    # Doctor name appears in two header tables
    HeaderLabel(
        id="doctor_name_header1",
        table_index=0,
        row=1,
        col=0,
        original_text="Nom et prénom du médecin",
        label="Nom et prénom du médecin (en-tête page 1)",
        section="header",
    ),
    HeaderLabel(
        id="doctor_name_header2",
        table_index=2,
        row=0,
        col=0,
        original_text="Nom et prénom du médecin",
        label="Nom et prénom du médecin (en-tête page 2)",
        section="header",
    ),
]

# ---------- Section: Stade de la procédure ----------

STADE_FIELDS: list[FormField] = [
    # Fields 0-3 are inline text fields: bold/underline the selected one.
    # Only ONE should be selected; the rest stay plain.
    FormField(
        id="stade_procedure",
        ff_index=0,  # Index of first option; options span ff_index 0-3
        field_type=FieldType.SELECT_ONE,
        label="Stade de la procédure",
        section="stade",
        hint="Choisir un seul parmi les 4 options",
        options=[
            "Première demande AI",  # ff_index 0
            "Nouvelle demande AI",  # ff_index 1
            "Révision d'office",  # ff_index 2
            "Demande de révision",  # ff_index 3
        ],
    ),
]

# ---------- Section: Informations ----------

INFO_FIELDS: list[FormField] = [
    FormField(
        id="questions_complementaires",
        ff_index=4,
        field_type=FieldType.TEXT,
        label="Questions complémentaires",
        section="informations",
        hint="Questions spécifiques posées par l'OAI, ou 'néant'",
    ),
    FormField(
        id="periode_du",
        ff_index=5,
        field_type=FieldType.DATE,
        label="Période: du",
        section="informations",
        hint="Date de début de la période couverte (DD.MM.YYYY)",
    ),
    FormField(
        id="periode_au",
        ff_index=6,
        field_type=FieldType.DATE,
        label="Période: au",
        section="informations",
        hint="Date de fin de la période couverte (DD.MM.YYYY)",
    ),
]

# ---------- Section 1: Informations générales ----------

SECTION1_FIELDS: list[FormField] = [
    FormField(
        id="date_derniere_consultation",
        ff_index=7,
        field_type=FieldType.DATE,
        label="Date de la dernière consultation",
        section="1_informations_generales",
    ),
    FormField(
        id="consultations_precedentes_par",
        ff_index=8,
        field_type=FieldType.TEXT,
        label="Des consultations ont été effectuées précédemment par",
        section="1_informations_generales",
        hint="Nom et spécialité du médecin précédent, ou vide",
    ),
    FormField(
        id="consultations_ulterieures_par",
        ff_index=9,
        field_type=FieldType.TEXT,
        label="Des consultations ont été effectuées à une date ultérieure par",
        section="1_informations_generales",
        hint="Nom et spécialité, ou vide",
    ),
    FormField(
        id="frequence_consultations",
        ff_index=10,
        field_type=FieldType.TEXT,
        label="À quelle fréquence voyez-vous le patient actuellement ?",
        section="1_informations_generales",
        hint="Ex: '1x/semaine', 'toutes les 2 semaines', '1x/mois'",
    ),
    # Incapacity table: 3 rows × 3 columns (%, du, au)
    # Row 0 = most recent, Row 2 = oldest
    FormField(
        id="incapacite_pct_1",
        ff_index=11,
        field_type=FieldType.TEXT,
        label="Incapacité de travail (%): ligne 1",
        section="1_informations_generales",
        hint="Pourcentage d'incapacité, ex: '100%', '50%'",
    ),
    FormField(
        id="incapacite_du_1",
        ff_index=12,
        field_type=FieldType.DATE,
        label="Incapacité de travail (du): ligne 1",
        section="1_informations_generales",
    ),
    FormField(
        id="incapacite_au_1",
        ff_index=13,
        field_type=FieldType.DATE,
        label="Incapacité de travail (au): ligne 1",
        section="1_informations_generales",
    ),
    FormField(
        id="incapacite_pct_2",
        ff_index=14,
        field_type=FieldType.TEXT,
        label="Incapacité de travail (%): ligne 2",
        section="1_informations_generales",
    ),
    FormField(
        id="incapacite_du_2",
        ff_index=15,
        field_type=FieldType.DATE,
        label="Incapacité de travail (du): ligne 2",
        section="1_informations_generales",
    ),
    FormField(
        id="incapacite_au_2",
        ff_index=16,
        field_type=FieldType.DATE,
        label="Incapacité de travail (au): ligne 2",
        section="1_informations_generales",
    ),
    FormField(
        id="incapacite_pct_3",
        ff_index=17,
        field_type=FieldType.TEXT,
        label="Incapacité de travail (%): ligne 3",
        section="1_informations_generales",
    ),
    FormField(
        id="incapacite_du_3",
        ff_index=18,
        field_type=FieldType.DATE,
        label="Incapacité de travail (du): ligne 3",
        section="1_informations_generales",
    ),
    FormField(
        id="incapacite_au_3",
        ff_index=19,
        field_type=FieldType.DATE,
        label="Incapacité de travail (au): ligne 3",
        section="1_informations_generales",
    ),
    FormField(
        id="activites_incapacite",
        ff_index=20,
        field_type=FieldType.TEXT,
        label="Pour quelles activités avez-vous attesté une incapacité de travail ?",
        section="1_informations_generales",
    ),
    FormField(
        id="autres_intervenants",
        ff_index=21,
        field_type=FieldType.TEXT,
        label="Y a-t-il d'autres intervenants (médecins, hôpitaux, thérapeutes) ?",
        section="1_informations_generales",
        hint="Noms, spécialités et rôles, ou 'Non'",
    ),
]

# ---------- Section 2: Situation médicale ----------

SECTION2_FIELDS: list[FormField] = [
    FormField(
        id="antecedents_evolution",
        ff_index=22,
        field_type=FieldType.TEXT,
        label="Antécédents médicaux et évolution de la situation",
        section="2_situation_medicale",
        hint="Résumé de l'historique médical et de l'évolution",
    ),
    FormField(
        id="situation_symptomes_actuels",
        ff_index=23,
        field_type=FieldType.TEXT,
        label="Situation et symptômes médicaux actuels",
        section="2_situation_medicale",
    ),
    FormField(
        id="medication_actuelle",
        ff_index=24,
        field_type=FieldType.TEXT,
        label="Médication actuelle (y compris le dosage)",
        section="2_situation_medicale",
        hint="Liste des médicaments avec dosages",
    ),
    FormField(
        id="constats_medicaux",
        ff_index=25,
        field_type=FieldType.TEXT,
        label="Constats médicaux complets sur la base des examens pratiqués",
        section="2_situation_medicale",
    ),
    FormField(
        id="diagnostics_pertinents",
        ff_index=26,
        field_type=FieldType.TEXT,
        label="Diagnostics pertinents pour l'AI (codes CIM avec descriptions)",
        section="2_situation_medicale",
        hint="Format: code CIM — description. Un par ligne.",
    ),
    FormField(
        id="diagnostics_non_pertinents",
        ff_index=27,
        field_type=FieldType.TEXT,
        label="Diagnostics sans influence sur la capacité de travail",
        section="2_situation_medicale",
        hint="Format: code CIM — description. Un par ligne, ou vide.",
    ),
    FormField(
        id="pronostic_capacite_travail",
        ff_index=28,
        field_type=FieldType.TEXT,
        label="Pronostic sur la capacité de travail",
        section="2_situation_medicale",
    ),
    FormField(
        id="plan_traitement",
        ff_index=29,
        field_type=FieldType.TEXT,
        label="Prochaines mesures / plan de traitement",
        section="2_situation_medicale",
        hint="Thérapies, opérations, médicaments envisagés",
    ),
]

# ---------- Section 3: Situation professionnelle ----------

SECTION3_FIELDS: list[FormField] = [
    FormField(
        id="activite_actuelle",
        ff_index=30,
        field_type=FieldType.TEXT,
        label="Quelle est l'activité actuelle du patient ?",
        section="3_situation_professionnelle",
        hint="Emploi, employeur, taux d'occupation, arrêt depuis quand",
    ),
    FormField(
        id="activite_actuelle_inconnu",
        ff_index=31,
        field_type=FieldType.CHECKBOX,
        label="Je ne suis pas en mesure de répondre (activité actuelle)",
        section="3_situation_professionnelle",
    ),
    FormField(
        id="situation_professionnelle_info",
        ff_index=32,
        field_type=FieldType.TEXT,
        label="Informations sur la situation professionnelle avant l'atteinte",
        section="3_situation_professionnelle",
    ),
    FormField(
        id="situation_professionnelle_inconnu",
        ff_index=33,
        field_type=FieldType.CHECKBOX,
        label="Aucune information (situation professionnelle)",
        section="3_situation_professionnelle",
    ),
    FormField(
        id="exigences_activite",
        ff_index=34,
        field_type=FieldType.TEXT,
        label="Exigences de l'activité professionnelle",
        section="3_situation_professionnelle",
        hint="Effort physique, répétitif, fonction de surveillance, etc.",
    ),
    FormField(
        id="exigences_activite_inconnu",
        ff_index=35,
        field_type=FieldType.CHECKBOX,
        label="Je ne suis pas en mesure de répondre (exigences)",
        section="3_situation_professionnelle",
    ),
    FormField(
        id="limitations_fonctionnelles",
        ff_index=36,
        field_type=FieldType.TEXT,
        label="Limitations fonctionnelles",
        section="3_situation_professionnelle",
        hint="Concentration, endurance, résistance au stress, etc.",
    ),
    FormField(
        id="limitations_fonctionnelles_inconnu",
        ff_index=37,
        field_type=FieldType.CHECKBOX,
        label="Je ne suis pas en mesure de répondre (limitations)",
        section="3_situation_professionnelle",
    ),
    FormField(
        id="ressources_patient",
        ff_index=38,
        field_type=FieldType.TEXT,
        label="Ressources du patient",
        section="3_situation_professionnelle",
        hint="Langues, formations, activités extraprofessionnelles, etc.",
    ),
    FormField(
        id="ressources_patient_inconnu",
        ff_index=39,
        field_type=FieldType.CHECKBOX,
        label="Je ne suis pas en mesure de répondre (ressources)",
        section="3_situation_professionnelle",
    ),
    FormField(
        id="capacite_conduire",
        ff_index=40,
        field_type=FieldType.TEXT,
        label="Doutes quant à la capacité de conduire ?",
        section="3_situation_professionnelle",
        hint="'Pas de doute' ou description des doutes",
    ),
    FormField(
        id="capacite_conduire_inconnu",
        ff_index=41,
        field_type=FieldType.CHECKBOX,
        label="Je ne suis pas en mesure de répondre (capacité conduire)",
        section="3_situation_professionnelle",
    ),
    FormField(
        id="heures_travail_activite_habituelle",
        ff_index=42,
        field_type=FieldType.TEXT,
        label="Heures de travail/jour dans l'activité habituelle",
        section="3_situation_professionnelle",
        hint="Ex: '4h/jour (50%)'. Inclure limitations.",
    ),
    FormField(
        id="heures_travail_habituelle_inconnu",
        ff_index=43,
        field_type=FieldType.CHECKBOX,
        label="Je ne suis pas en mesure de répondre (heures habituelle)",
        section="3_situation_professionnelle",
    ),
    FormField(
        id="heures_travail_activite_adaptee",
        ff_index=44,
        field_type=FieldType.TEXT,
        label="Heures de travail/jour dans une activité adaptée",
        section="3_situation_professionnelle",
        hint="Ex: '6h/jour (75%)'. Décrire le type d'activité adaptée.",
    ),
]

# ---------- Section 4: Potentiel de réadaptation ----------

SECTION4_FIELDS: list[FormField] = [
    FormField(
        id="pronostic_readaptation",
        ff_index=45,
        field_type=FieldType.TEXT,
        label="Pronostic sur le potentiel de réadaptation",
        section="4_potentiel_readaptation",
    ),
    FormField(
        id="obstacles_readaptation",
        ff_index=46,
        field_type=FieldType.TEXT,
        label="Facteurs faisant obstacle à une réadaptation",
        section="4_potentiel_readaptation",
    ),
    FormField(
        id="limitations_vie_quotidienne",
        ff_index=47,
        field_type=FieldType.TEXT,
        label="Limitations dans les activités de la vie quotidienne",
        section="4_potentiel_readaptation",
        hint="Ménage, repas, nettoyage, achats, lessive, soins corporels, déplacements",
    ),
    FormField(
        id="limitations_vie_quotidienne_inconnu",
        ff_index=48,
        field_type=FieldType.CHECKBOX,
        label="Je ne suis pas en mesure de répondre (vie quotidienne)",
        section="4_potentiel_readaptation",
    ),
]

# ---------- Questions psychiatriques ----------

# Checkbox: evaluation globale récente (Oui/Non)
PSYCH_EVAL_FIELDS: list[FormField] = [
    FormField(
        id="evaluation_globale_oui",
        ff_index=49,
        field_type=FieldType.CHECKBOX,
        label="Évaluation globale récente (6 mois): Oui",
        section="questions_psychiatriques",
    ),
    FormField(
        id="evaluation_globale_non",
        ff_index=50,
        field_type=FieldType.CHECKBOX,
        label="Évaluation globale récente (6 mois): Non",
        section="questions_psychiatriques",
    ),
]

# Section A: Freins — table 33, 15 data rows, columns: Oui/Non/Ne sais pas/Préciser
_SECTION_A_ITEMS = [
    ("a01", "Difficultés relationnelles ressenties par la personne assurée"),
    ("a02", "Hostilité ou agressivité"),
    ("a03", "Bizarreries du comportement"),
    ("a04", "Difficultés dans la gestion des émotions"),
    ("a05", "Apragmatisme"),
    ("a06", "Difficultés liées aux tâches administratives"),
    ("a07", "Difficultés pour maintenir l'hygiène personnelle"),
    ("a08", "Difficultés d'autonomie dans les autres activités de la vie quotidienne"),
    ("a09", "Difficultés dans les déplacements"),
    ("a10", "Difficultés à maintenir un rythme diurne/nocturne"),
    ("a11", "Difficultés d'organisation du temps"),
    ("a12", "Difficultés dans la reconnaissance de la maladie"),
    ("a13", "Hypersensibilité au stress"),
    ("a14", "Apparition périodique de phases de décompensation"),
    ("a15", "Autres troubles fonctionnels non mentionnés"),
]

SECTION_A_FIELDS: list[TableCell] = []
for idx, (key, label) in enumerate(_SECTION_A_ITEMS):
    # Each row has 4 fillable columns: Oui(1), Non(2), Ne sais pas(3), Préciser(4)
    SECTION_A_FIELDS.append(
        TableCell(
            id=f"{key}_choice",
            table_index=33,
            row=idx + 1,
            col=-1,  # col determined by choice value
            field_type=FieldType.CHOICE,
            label=f"A.{idx + 1}. {label}",
            section="psych_a_freins",
            hint="Répondre: 'oui', 'non', ou 'ne_sais_pas'",
        )
    )
    SECTION_A_FIELDS.append(
        TableCell(
            id=f"{key}_detail",
            table_index=33,
            row=idx + 1,
            col=4,
            field_type=FieldType.TEXT,
            label=f"A.{idx + 1}. {label} — préciser si oui",
            section="psych_a_freins",
            hint="Laisser vide si Non ou Ne sais pas",
        )
    )

# Section B: Capacités cognitives — table 34, 6 data rows
# Columns: Non limitée(1), Limitée(2), genre(3)
_SECTION_B_ITEMS = [
    ("b01", "Capacité d'orientation dans le temps, l'espace ou par rapport à soi-même"),
    ("b02", "Capacité de concentration/attention"),
    ("b03", "Capacité de compréhension"),
    ("b04", "Capacités mnésiques"),
    ("b05", "Capacité d'organisation/planification"),
    ("b06", "Capacité d'adaptation au changement"),
]

SECTION_B_FIELDS: list[TableCell] = []
for idx, (key, label) in enumerate(_SECTION_B_ITEMS):
    SECTION_B_FIELDS.append(
        TableCell(
            id=f"{key}_choice",
            table_index=34,
            row=idx + 1,
            col=-1,
            field_type=FieldType.CHOICE,
            label=f"B.{idx + 1}. {label}",
            section="psych_b_capacites",
            hint="Répondre: 'non_limitee' ou 'limitee'",
        )
    )
    SECTION_B_FIELDS.append(
        TableCell(
            id=f"{key}_detail",
            table_index=34,
            row=idx + 1,
            col=3,
            field_type=FieldType.TEXT,
            label=f"B.{idx + 1}. {label} — genre de limitation",
            section="psych_b_capacites",
            hint="Laisser vide si non limitée",
        )
    )

# Section C: Activités encore possibles — table 35, 8 data rows
# Columns: Oui(1), Non(2), De manière fluctuante(3), Préciser(4)
_SECTION_C_ITEMS = [
    ("c01", "Activités en contact avec la clientèle ou exigeant de fréquents contacts"),
    ("c02", "Activités exigeant une grande autonomie"),
    ("c03", "Activités exigeant de l'endurance"),
    ("c04", "Activités exigeant de la précision"),
    ("c05", "Activités impliquant du stress"),
    ("c06", "Activités exigeant de la rapidité"),
    ("c07", "Activités exigeant une adaptation permanente"),
    ("c08", "Activités impliquant des tâches complexes"),
]

SECTION_C_FIELDS: list[TableCell] = []
for idx, (key, label) in enumerate(_SECTION_C_ITEMS):
    SECTION_C_FIELDS.append(
        TableCell(
            id=f"{key}_choice",
            table_index=35,
            row=idx + 1,
            col=-1,
            field_type=FieldType.CHOICE,
            label=f"C.{idx + 1}. {label}",
            section="psych_c_activites",
            hint="Répondre: 'oui', 'non', ou 'fluctuant'",
        )
    )
    SECTION_C_FIELDS.append(
        TableCell(
            id=f"{key}_detail",
            table_index=35,
            row=idx + 1,
            col=4,
            field_type=FieldType.TEXT,
            label=f"C.{idx + 1}. {label} — préciser si non ou fluctuant",
            section="psych_c_activites",
            hint="Laisser vide si Oui",
        )
    )

# Section D: Rythme de travail — table 36, 3 data rows
# D.1 and D.2: Oui(1), Non(2), detail(3)
# D.3: Fréquence(1), Durée(2)
SECTION_D_FIELDS: list[TableCell] = [
    TableCell(
        id="d01_choice",
        table_index=36,
        row=1,
        col=-1,
        field_type=FieldType.CHOICE,
        label="D.1. À plein temps ?",
        section="psych_d_rythme",
        hint="Répondre: 'oui' ou 'non'",
    ),
    TableCell(
        id="d01_detail",
        table_index=36,
        row=1,
        col=3,
        field_type=FieldType.TEXT,
        label="D.1. Si oui, avec quel rendement ?",
        section="psych_d_rythme",
        hint="Ex: 'Rendement 80%'. Vide si non.",
    ),
    TableCell(
        id="d02_choice",
        table_index=36,
        row=2,
        col=-1,
        field_type=FieldType.CHOICE,
        label="D.2. À temps partiel ?",
        section="psych_d_rythme",
        hint="Répondre: 'oui' ou 'non'",
    ),
    TableCell(
        id="d02_detail",
        table_index=36,
        row=2,
        col=3,
        field_type=FieldType.TEXT,
        label="D.2. Si oui, à quel taux ? avec quel rendement ?",
        section="psych_d_rythme",
        hint="Ex: 'Taux: 50%, rendement: 80%'",
    ),
    TableCell(
        id="d03_frequence",
        table_index=36,
        row=3,
        col=1,
        field_type=FieldType.TEXT,
        label="D.3. Fréquence prévisible des absences",
        section="psych_d_rythme",
        hint="Ex: '2-3 fois/an'",
    ),
    TableCell(
        id="d03_duree",
        table_index=36,
        row=3,
        col=2,
        field_type=FieldType.TEXT,
        label="D.3. Durée prévisible des absences",
        section="psych_d_rythme",
        hint="Ex: '2-4 semaines'",
    ),
]

# ---------- Divers / Signature / Annexe ----------

CLOSING_FIELDS: list[FormField] = [
    FormField(
        id="divers",
        ff_index=51,
        field_type=FieldType.TEXT,
        label="Divers — autres éléments à signaler",
        section="divers",
        hint="Informations complémentaires ou 'Aucune information complémentaire à signaler.'",
    ),
    FormField(
        id="date_signature",
        ff_index=52,
        field_type=FieldType.DATE,
        label="Date",
        section="signature",
    ),
    FormField(
        id="signature_medecin",
        ff_index=53,
        field_type=FieldType.TEXT,
        label="Nom, Prénom, adresse exacte (cabinet/service) et signature du médecin",
        section="signature",
        hint="Nom, titre, adresse du cabinet du médecin signataire",
    ),
    FormField(
        id="annexes",
        ff_index=54,
        field_type=FieldType.TEXT,
        label="Annexes",
        section="signature",
        hint="Liste des annexes jointes, ou 'Rien à signaler'",
    ),
]


# ── Choice column mappings ──────────────────────────────────
# Maps choice string values to column indices for each table section.

CHOICE_COLUMNS: dict[str, dict[str, int]] = {
    # Section A: Oui=1, Non=2, Ne sais pas=3
    "psych_a_freins": {"oui": 1, "non": 2, "ne_sais_pas": 3},
    # Section B: Non limitée=1, Limitée=2
    "psych_b_capacites": {"non_limitee": 1, "limitee": 2},
    # Section C: Oui=1, Non=2, Fluctuant=3
    "psych_c_activites": {"oui": 1, "non": 2, "fluctuant": 3},
    # Section D (D.1 & D.2): Oui=1, Non=2
    "psych_d_rythme": {"oui": 1, "non": 2},
}


# ── Aggregate all fields ────────────────────────────────────

ALL_FORM_FIELDS: list[FormField] = (
    STADE_FIELDS
    + INFO_FIELDS
    + SECTION1_FIELDS
    + SECTION2_FIELDS
    + SECTION3_FIELDS
    + SECTION4_FIELDS
    + PSYCH_EVAL_FIELDS
    + CLOSING_FIELDS
)

ALL_TABLE_CELLS: list[TableCell] = (
    SECTION_A_FIELDS + SECTION_B_FIELDS + SECTION_C_FIELDS + SECTION_D_FIELDS
)

ALL_HEADER_LABELS: list[HeaderLabel] = HEADER_FIELDS


def get_ai_prompt_schema() -> list[dict]:
    """
    Return a list of field descriptors suitable for inclusion in an AI
    prompt.  Each dict has: id, type, label, section, hint.
    The AI should return a JSON object keyed by field id.
    """
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
        if f.options:
            entry["options"] = f.options
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
