from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field
from app.rubriques.models import Rubriques

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

RubriqueKey = Literal[
    "r01_historique",
    "r02_clinique",
    "r03_traitement",
    "r04_professionnel",
    "r05_capacite_travail",
    "r06_readaptation",
    "r07_freins_cognition",
    "r08_activites",
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
    rubriques: list[RubriqueKey] = Field(
        ...,
        description="1 to 4 rubrique keys this document contributes to",
    )


class ClassifiedDocument(BaseModel):
    """A classified document returned by POST /api/classify."""

    filename: str
    classification: DocumentClassification


class PatientInfo(BaseModel):
    """Demographic and background info extracted from the dossier."""

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


class PatientDossier(BaseModel):
    """Complete structured output from dossier parsing."""

    patient_info: PatientInfo
    rubriques: Rubriques = Field(default_factory=Rubriques)
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
    rubriques: Rubriques | None = None
    notes: str | None = None


class DossierResponse(BaseModel):
    """Dossier with its server-side ID."""

    dossier_id: str
    dossier: PatientDossier


class ChatRequest(BaseModel):
    """Request body for POST /api/dossier-chat."""

    question: str = Field(
        ..., min_length=1, description="Question about the patient dossier"
    )
    raw_content: str = Field(
        ..., min_length=1, description="Full extracted text from all documents"
    )


class ChatResponse(BaseModel):
    answer: str
