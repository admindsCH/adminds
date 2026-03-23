"""Constants for classification and dossier parsing: prompts, field maps, config."""

from __future__ import annotations

# Accepted upload file extensions.
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png", ".tiff", ".bmp"}


# --- Classification system prompt (Step 1: per-file labeling) ---
# Quick classification for UI badges. Returns DocumentClassification.

CLASSIFICATION_SYSTEM_PROMPT = """\
Tu es un psychiatre expert suisse spécialisé dans les rapports AI \
(assurance invalidité). Tu reçois le texte extrait d'un document médical pour le classer.

Ton rôle:
- Identifier le type de document (consultation, rapport antérieur, \
hospitalisation, ordonnance, bilan, document professionnel, grille fonctionnelle, \
dossier patient SMEEX, ou autre)
- Déterminer la date du document (si visible)
- Identifier l'auteur (psychiatre traitant, médecin généraliste, spécialiste, \
hôpital, employeur, assurance, ou inconnu)
- Résumer le contenu en une phrase factuelle de maximum 20 mots
- Identifier les rubriques auxquelles ce document contribue \
(r01_historique, r02_clinique, r03_traitement, r04_professionnel, \
r05_capacite_travail, r06_readaptation, r07_freins_cognition, r08_activites)

Sois précis et factuel."""


# --- Report type -> required rubriques mapping ---
# Declares which rubriques each report type needs.
# Used at generation time to select which rubriques to include in the LLM context.

REPORT_RUBRIQUE_MAP: dict[str, list[str]] = {
    "rapport_ai": [
        "r01_historique",
        "r02_clinique",
        "r03_traitement",
        "r04_professionnel",
        "r05_capacite_travail",
        "r06_readaptation",
        "r07_freins_cognition",
        "r08_activites",
    ],
    # Future report types — just list the rubriques they need:
    # "certificat_incapacite": ["r02_clinique", "r05_capacite_travail"],
    # "rapport_medical_simple": ["r01_historique", "r02_clinique", "r03_traitement"],
}
