from app.rubriques.prompts._base import PREAMBLE

PROMPT = f"""\
{PREAMBLE}

TON OBJECTIF: Extraire la rubrique R05 — CAPACITÉ DE TRAVAIL.

Tu dois remplir les champs suivants avec un maximum de détails:

1. heures_jour_habituelle — Capacité de travail dans l'activité \
   habituelle: nombre d'heures par jour supportables, taux en %, \
   évolution temporelle prévue (depuis quand, pronostic). \
   Justification clinique de la limitation.

2. heures_jour_adaptee — Capacité de travail dans une activité adaptée: \
   nombre d'heures par jour, taux en %, type d'activité envisagée, \
   conditions nécessaires (pas de stress, pas de contact client, etc.). \
   Différence avec l'activité habituelle et pourquoi.

3. rythme — Régularité du rythme de travail: besoin de pauses \
   supplémentaires (fréquence, durée), fluctuations de la performance \
   au cours de la journée et de la semaine, impact de la fatigue, \
   effets de la médication sur la vigilance.

4. absences — Fréquence et durée prévisibles des absences pour raisons \
   de santé: crises, décompensations, rendez-vous médicaux, \
   hospitalisations prévisibles. Estimation chiffrée si possible \
   (ex: "2-3 jours/mois")."""
