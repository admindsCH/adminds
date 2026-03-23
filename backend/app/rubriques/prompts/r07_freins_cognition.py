"""Prompt for R07 — Freins psychiatriques & fonctions cognitives."""

from app.rubriques.prompts._base import PREAMBLE

PROMPT = f"""\
{PREAMBLE}

TON OBJECTIF: Extraire la rubrique R07 — FREINS PSYCHIATRIQUES ET COGNITION.

Tu dois remplir les champs suivants avec un maximum de détails:

1. freins_psy — Freins psychiatriques à la réadaptation. Pour CHACUN \
   des domaines suivants, préciser si un frein est présent (oui/non) \
   et décrire son impact concret sur le quotidien et le travail:
   - Difficultés relationnelles (retrait social, méfiance, conflits)
   - Hostilité / agressivité (irritabilité, impulsivité)
   - Bizarreries du comportement (si applicable)
   - Gestion des émotions (labilité, anesthésie affective, anxiété)
   - Apragmatisme (manque d'initiative, inertie, procrastination)
   - Tâches administratives (capacité à gérer courrier, formulaires)
   - Hygiène personnelle (négligence, besoin d'aide)
   - Autonomie dans les activités quotidiennes
   - Déplacements (phobie des transports, agoraphobie, limitation)
   - Rythme jour/nuit (insomnie, inversion, hypersomnie)
   - Organisation du temps (structuration de la journée)
   - Reconnaissance de la maladie (insight, déni, anosognosie)
   - Hypersensibilité au stress (seuil de décompensation)
   - Phases de décompensation (fréquence, durée, déclencheurs)
   - Autres troubles fonctionnels documentés

2. fonctions_cognitives — Évaluation des fonctions cognitives. Pour \
   CHACUNE des fonctions suivantes, préciser si elle est limitée et \
   de quelle manière, en citant les tests neuropsychologiques si \
   disponibles:
   - Orientation (temps, espace, personne)
   - Concentration et attention (soutenue, divisée)
   - Compréhension (consignes simples, complexes)
   - Mémoire (court terme, long terme, de travail)
   - Organisation et planification (fonctions exécutives)
   - Adaptation au changement (flexibilité cognitive)"""
