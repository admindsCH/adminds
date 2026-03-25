from app.rubriques.prompts._base import PREAMBLE

PROMPT = f"""\
{PREAMBLE}

TON OBJECTIF: Extraire la rubrique R01 — HISTORIQUE MÉDICAL ET PSYCHIATRIQUE.

Tu dois remplir les champs suivants avec un maximum de détails:

1. antecedents — Histoire complète: premiers symptômes psychiatriques, \
   hospitalisations passées, traitements antérieurs, comorbidités somatiques. \
   Chronologie détaillée depuis le début des troubles.

2. periode_traitement — Début du suivi psychiatrique, durée totale, \
   interruptions éventuelles et raisons. Dates précises si disponibles.

3. consultations — Historique des consultations: fréquence, type \
   (psychiatrique, psychothérapeutique, somatique), évolution dans le temps. \
   Changements de fréquence et raisons.

4. intervenants — Tous les professionnels impliqués: psychiatres, médecins \
   généralistes, psychologues, thérapeutes, hôpitaux, cliniques. \
   Pour chacun: nom, rôle, période d'intervention.

5. cause_incapacite — Cause initiale de l'incapacité de travail: circonstances \
   de survenue, événement déclencheur, date de début, contexte professionnel \
   et personnel au moment de la décompensation.

6. timeline — Liste structurée d'événements cliniques en ordre chronologique. \
   Chaque entrée = un événement distinct (consultation, lettre, certificat, \
   bilan, hospitalisation, note de suivi). Pour chaque entrée: date \
   (YYYY-MM-DD si connue), titre court, source/auteur, résumé factuel \
   en 2-3 phrases. Inclure TOUS les événements documentés, pas seulement \
   les principaux."""
