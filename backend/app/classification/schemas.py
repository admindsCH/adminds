"""Pydantic models for classification"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

CategoryType = Literal[
    "consultation_note",
    "rapport_anterieur",
    "hospitalisation",
    "medication",
    "bilan_evaluation",
    "document_professionnel",
    "evaluation_fonctionnelle",
    "dpi_smeex",
    "autre",
]

AuthorType = Literal[
    "psychiatre_traitant",
    "medecin_generaliste",
    "specialiste_autre",
    "hopital",
    "employeur",
    "assurance",
    "inconnu",
]

RapportAiField = Literal[
    "antecedents",
    "situation_actuelle",
    "medication",
    "constats_medicaux",
    "diagnostics_incapacitants",
    "diagnostics_sans_incidence",
    "pronostic_capacite_travail",
    "plan_traitement",
    "situation_professionnelle",
    "limitations_fonctionnelles",
    "freins_readaptation",
    "capacite_readaptation",
    "fonctions_cognitives",
    "activites_possibles",
]


class DocumentClassification(BaseModel):
    """Classification result for a single uploaded file."""

    category: CategoryType
    date: str | None = Field(
        None,
        description="Document date: YYYY-MM-DD if visible, YYYY-MM if month only, null if not found",
    )
    author_type: AuthorType
    summary: str = Field(
        ...,
        description="1 phrase factuelle en français, max 20 mots",
    )
    rapport_ai_fields: list[RapportAiField] = Field(
        ...,
        description="1 to 4 semantic field keys this document contributes to",
    )


class ClassifiedDocument(BaseModel):
    """A classified document returned by POST /api/classify."""

    filename: str
    classification: DocumentClassification


class PatientInfo(BaseModel):
    """Demographic and background info extracted from the dossier.

    All fields optional — we extract what we find
    """

    age: int | None = Field(None, description="Âge du patient si mentionné")
    sexe: Literal["homme", "femme", "inconnu"] | None = Field(
        None, description="Sexe du patient si identifiable"
    )
    situation_sociale: str | None = Field(
        None,
        description="Résumé de la situation sociale: état civil, enfants, emploi, logement",
    )
    antecedents: str | None = Field(
        None,
        description="Antécédents médicaux et psychiatriques significatifs (somatiques + psy)",
    )


class TimelineEntry(BaseModel):
    """A single clinical event extracted from the dossier.

    Represents any distinct block of information: consultation, letter,
    certificate, hospitalization report, etc. Format-agnostic.
    """

    date: str | None = Field(
        None, description="Date de l'événement: YYYY-MM-DD si connue, null sinon"
    )
    title: str = Field(
        ...,
        description="Titre court: '1er entretien', 'Lettre de sortie', 'Certificat AT'...",
    )
    source: str | None = Field(None, description="Auteur ou source du document")
    summary: str = Field(
        ...,
        description="Résumé factuel du contenu en 2-3 phrases maximum",
    )


class Medication(BaseModel):
    """A medication mentioned anywhere in the dossier."""

    nom: str = Field(..., description="Nom du médicament")
    dosage: str | None = Field(None, description="Dosage si mentionné: '100mcg 6/7j'")
    date: str | None = Field(
        None,
        description="Date de prescription ou mention: YYYY-MM-DD si connue, null sinon",
    )


class Diagnostic(BaseModel):
    """A diagnosis mentioned anywhere in the dossier."""

    label: str = Field(..., description="Intitulé du diagnostic")
    code_cim: str | None = Field(None, description="Code CIM-10 si mentionné: 'F43.22'")
    type: Literal["incapacitant", "sans_incidence", "inconnu"] = Field(
        "inconnu",
        description="Impact sur la capacité de travail si déterminable",
    )


class RapportAiFields(BaseModel):
    """The 14 semantic fields of the rapport AI, pre-filled with extracted content.

    Each field contains synthesized text ready for the report template.
    Canton-agnostic — mapped to form sections at generation time (Step 4).
    All optional: only filled if relevant info was found in the dossier.
    """

    antecedents: str | None = Field(
        None, description="Antécédents psychiatriques et somatiques pertinents"
    )
    situation_actuelle: str | None = Field(
        None, description="Situation clinique actuelle du patient"
    )
    medication: str | None = Field(
        None, description="Traitement médicamenteux actuel et passé pertinent"
    )
    constats_medicaux: str | None = Field(
        None, description="Constats médicaux objectifs (examen clinique, bilans)"
    )
    diagnostics_incapacitants: str | None = Field(
        None,
        description="Diagnostics avec répercussion sur la capacité de travail (codes CIM)",
    )
    diagnostics_sans_incidence: str | None = Field(
        None, description="Diagnostics sans répercussion sur la capacité de travail"
    )
    pronostic_capacite_travail: str | None = Field(
        None, description="Pronostic concernant la capacité de travail"
    )
    plan_traitement: str | None = Field(
        None, description="Plan de traitement actuel et propositions thérapeutiques"
    )
    situation_professionnelle: str | None = Field(
        None, description="Activité professionnelle, poste, taux, arrêts de travail"
    )
    limitations_fonctionnelles: str | None = Field(
        None, description="Limitations fonctionnelles découlant des diagnostics"
    )
    freins_readaptation: str | None = Field(
        None, description="Freins et obstacles à la réadaptation professionnelle"
    )
    capacite_readaptation: str | None = Field(
        None, description="Capacité de réadaptation et ressources mobilisables"
    )
    fonctions_cognitives: str | None = Field(
        None,
        description="Fonctions cognitives: orientation, concentration, mémoire, etc.",
    )
    activites_possibles: str | None = Field(
        None, description="Activités encore possibles malgré les limitations"
    )


class PatientDossier(BaseModel):
    """Complete structured output from dossier parsing."""

    patient_info: PatientInfo
    timeline: list[TimelineEntry] = Field(
        ..., description="Entrées cliniques en ordre chronologique"
    )
    medications: list[Medication] = Field(
        default_factory=list,
        description="Médicaments consolidés depuis toutes les sources",
    )
    diagnostics: list[Diagnostic] = Field(
        default_factory=list,
        description="Diagnostics consolidés depuis toutes les sources",
    )
    rapport_ai_fields: RapportAiFields
    notes: str | None = Field(
        None,
        description="Notes complémentaires du psychiatre (dictée ou saisie manuelle)",
    )
    raw_content: str | None = Field(
        None,
        description="Full extracted text from all uploaded documents, used for report generation",
    )


class PatientInfoPatch(BaseModel):
    """Partial update for PatientInfo. Only provided fields are applied."""

    age: int | None = None
    sexe: Literal["homme", "femme", "inconnu"] | None = None
    situation_sociale: str | None = None
    antecedents: str | None = None


class PatientDossierPatch(BaseModel):
    """Partial update for PatientDossier."""

    patient_info: PatientInfoPatch | None = None
    timeline: list[TimelineEntry] | None = None
    medications: list[Medication] | None = None
    diagnostics: list[Diagnostic] | None = None
    rapport_ai_fields: RapportAiFields | None = None
    notes: str | None = None


class DossierResponse(BaseModel):
    """Dossier with its server-side ID."""

    dossier_id: str
    dossier: PatientDossier
