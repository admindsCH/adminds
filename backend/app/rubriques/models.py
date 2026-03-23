"""
Rubrique models — the canonical intermediate data structure between
dossier parsing (Step 2) and report generation (Step 3).

Each rubrique (R01–R08) groups related clinical information:
- Prose fields (str | None) — narrative text for reports
- Structured lists — typed objects for UI display and precision

Adding a new rubrique = add one model + one field in Rubriques.
Adding a new sub-field = add one line in the rubrique model.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# --- Structured data types used within rubriques ---


class TimelineEntry(BaseModel):
    """A single clinical event extracted from the dossier."""

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


# --- Rubrique models ---


class R01Historique(BaseModel):
    """Medical and psychiatric history."""

    antecedents: str | None = Field(
        None,
        description="Antécédents psychiatriques et somatiques, ordre chronologique",
    )
    periode_traitement: str | None = Field(
        None,
        description="Période de traitement: début du suivi, durée, interruptions",
    )
    consultations: str | None = Field(
        None,
        description="Historique des consultations: fréquence, type, évolution",
    )
    intervenants: str | None = Field(
        None,
        description="Intervenants impliqués: psychiatres, médecins, thérapeutes, hôpitaux",
    )
    cause_incapacite: str | None = Field(
        None,
        description="Cause initiale de l'incapacité de travail et circonstances",
    )
    timeline: list[TimelineEntry] = Field(
        default_factory=list,
        description="Entrées cliniques en ordre chronologique",
    )


class R02Clinique(BaseModel):
    """Current clinical picture."""

    symptomes_actuels: str | None = Field(
        None,
        description="Symptômes actuels: nature, fréquence, intensité, impact quotidien",
    )
    constats_medicaux: str | None = Field(
        None,
        description="Constats objectifs: examen psychiatrique, tests neuropsychologiques, "
        "bilans somatiques, scores standardisés (GAF, BDI, etc.)",
    )
    diagnostics_incapacitants: str | None = Field(
        None,
        description="Diagnostics CIM-10 avec répercussion sur la capacité de travail, "
        "lien entre diagnostic et limitations fonctionnelles",
    )
    diagnostics_sans_incidence: str | None = Field(
        None,
        description="Diagnostics CIM-10 sans répercussion sur la capacité de travail, "
        "explication de pourquoi ils ne sont pas incapacitants",
    )
    frequence_consultations: str | None = Field(
        None,
        description="Fréquence actuelle des consultations et suivi",
    )
    diagnostics: list[Diagnostic] = Field(
        default_factory=list,
        description="Diagnostics consolidés depuis toutes les sources",
    )


class R03Traitement(BaseModel):
    """Medication, treatment plan, and prognosis."""

    medication: str | None = Field(
        None,
        description="Médication actuelle avec dosages, posologie, dates d'introduction; "
        "traitements passés et raisons d'arrêt",
    )
    plan_traitement: str | None = Field(
        None,
        description="Plan de traitement: psychothérapie (type, fréquence), "
        "pharmacothérapie, mesures de réadaptation proposées",
    )
    pronostic: str | None = Field(
        None,
        description="Pronostic: évolution attendue, arguments pour/contre amélioration, "
        "durée estimée d'incapacité",
    )
    medications: list[Medication] = Field(
        default_factory=list,
        description="Médicaments consolidés depuis toutes les sources",
    )


class R04Professionnel(BaseModel):
    """Professional situation and employment history."""

    activite: str | None = Field(
        None,
        description="Activité professionnelle actuelle ou dernière, taux d'emploi",
    )
    historique_emploi: str | None = Field(
        None,
        description="Historique professionnel: postes, durées, raisons de changement",
    )
    exigences_poste: str | None = Field(
        None,
        description="Exigences du poste actuel/dernier: physiques, cognitives, relationnelles",
    )
    historique_it: str | None = Field(
        None,
        description="Historique d'incapacité de travail: périodes, taux (%), "
        "dates des arrêts et reprises",
    )


class R05CapaciteTravail(BaseModel):
    """Work capacity assessment."""

    heures_jour_habituelle: str | None = Field(
        None,
        description="Capacité dans l'activité habituelle: heures/jour, taux, timeline",
    )
    heures_jour_adaptee: str | None = Field(
        None,
        description="Capacité dans une activité adaptée: heures/jour, taux, timeline",
    )
    rythme: str | None = Field(
        None,
        description="Rythme de travail: régularité, besoin de pauses, fluctuations",
    )
    absences: str | None = Field(
        None,
        description="Absences: fréquence, durée, causes, certificats AT",
    )


class R06Readaptation(BaseModel):
    """Re-adaptation potential and obstacles."""

    potentiel: str | None = Field(
        None,
        description="Potentiel de réadaptation: aptitude aux mesures professionnelles",
    )
    obstacles: str | None = Field(
        None,
        description="Obstacles à la réadaptation: médicaux, sociaux, motivationnels",
    )
    ressources: str | None = Field(
        None,
        description="Ressources mobilisables: compétences, motivation, soutien social",
    )
    taches_menageres: str | None = Field(
        None,
        description="Capacité pour les tâches ménagères et activités domestiques",
    )
    facteurs_environnementaux: str | None = Field(
        None,
        description="Facteurs environnementaux: logement, entourage, accès aux soins",
    )


class R07FreinsCognition(BaseModel):
    """Psychiatric brakes and cognitive functions."""

    freins_psy: str | None = Field(
        None,
        description="Freins psychiatriques à la réadaptation: difficultés relationnelles, "
        "gestion des émotions, hostilité, apragmatisme, hygiène, autonomie, "
        "déplacements, rythme jour/nuit, organisation du temps, "
        "reconnaissance de la maladie, hypersensibilité au stress, "
        "décompensations périodiques — pour chaque frein identifié, "
        "préciser s'il est présent et son impact concret",
    )
    fonctions_cognitives: str | None = Field(
        None,
        description="Évaluation des fonctions cognitives: orientation (temps, espace, soi), "
        "concentration et attention, compréhension, mémoire, "
        "organisation et planification, adaptation au changement — "
        "pour chaque fonction, préciser si elle est limitée et comment",
    )


class R08Activites(BaseModel):
    """Functional limitations and remaining activities."""

    limitations_fonctionnelles: str | None = Field(
        None,
        description="Limitations fonctionnelles concrètes découlant des diagnostics: "
        "ce que le patient ne peut plus faire, dans quelles circonstances",
    )
    activites_possibles: str | None = Field(
        None,
        description="Activités encore possibles malgré les limitations: "
        "contact clientèle, autonomie, endurance, précision, "
        "tolérance au stress, rapidité, adaptation, tâches complexes — "
        "pour chaque type d'activité, préciser si possible, impossible, "
        "ou possible de manière fluctuante",
    )
    capacite_conduire: str | None = Field(
        None,
        description="Capacité de conduire un véhicule: doutes éventuels et raisons",
    )


class Rubriques(BaseModel):
    """All 8 rubriques — the canonical patient data structure.

    Each rubrique defaults to an empty instance (all fields None).
    Only populated fields are used downstream.
    """

    r01_historique: R01Historique = Field(default_factory=R01Historique)
    r02_clinique: R02Clinique = Field(default_factory=R02Clinique)
    r03_traitement: R03Traitement = Field(default_factory=R03Traitement)
    r04_professionnel: R04Professionnel = Field(default_factory=R04Professionnel)
    r05_capacite_travail: R05CapaciteTravail = Field(default_factory=R05CapaciteTravail)
    r06_readaptation: R06Readaptation = Field(default_factory=R06Readaptation)
    r07_freins_cognition: R07FreinsCognition = Field(default_factory=R07FreinsCognition)
    r08_activites: R08Activites = Field(default_factory=R08Activites)
