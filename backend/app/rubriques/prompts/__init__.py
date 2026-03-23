"""Rubrique extraction prompts — one focused prompt per rubrique.

Usage:
    from app.rubriques.prompts import RUBRIQUE_PROMPTS, PATIENT_INFO_PROMPT

    RUBRIQUE_PROMPTS is a dict mapping rubrique key → system prompt string.
    Each prompt is tailored to extract only that rubrique's fields.
"""

from app.rubriques.prompts.patient_info import PROMPT as PATIENT_INFO_PROMPT  # noqa: F401
from app.rubriques.prompts.r01_historique import PROMPT as _R01
from app.rubriques.prompts.r02_clinique import PROMPT as _R02
from app.rubriques.prompts.r03_traitement import PROMPT as _R03
from app.rubriques.prompts.r04_professionnel import PROMPT as _R04
from app.rubriques.prompts.r05_capacite_travail import PROMPT as _R05
from app.rubriques.prompts.r06_readaptation import PROMPT as _R06
from app.rubriques.prompts.r07_freins_cognition import PROMPT as _R07
from app.rubriques.prompts.r08_activites import PROMPT as _R08

RUBRIQUE_PROMPTS: dict[str, str] = {
    "r01_historique": _R01,
    "r02_clinique": _R02,
    "r03_traitement": _R03,
    "r04_professionnel": _R04,
    "r05_capacite_travail": _R05,
    "r06_readaptation": _R06,
    "r07_freins_cognition": _R07,
    "r08_activites": _R08,
}
