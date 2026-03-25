from app.rubriques.prompts._base import PREAMBLE

PROMPT = f"""\
{PREAMBLE}

TON OBJECTIF: Extraire la rubrique R04 — SITUATION PROFESSIONNELLE.

Tu dois remplir les champs suivants avec un maximum de détails:

1. activite — Activité professionnelle actuelle ou dernière: intitulé \
   du poste, employeur, taux d'emploi (%), date de début de l'emploi, \
   date et raison de l'arrêt de travail. Situation contractuelle \
   (CDI, CDD, indépendant, licencié, fin de droit).

2. historique_emploi — Parcours professionnel complet: tous les postes \
   occupés, durées d'emploi, secteurs d'activité, raisons de changement, \
   formations professionnelles, diplômes, qualifications. Périodes de \
   chômage et raisons.

3. exigences_poste — Exigences du poste actuel ou dernier: efforts \
   physiques requis, charge cognitive, exigences relationnelles \
   (contact clientèle, travail en équipe), niveau de stress, \
   responsabilités, horaires, autonomie dans le travail.

4. historique_it — Historique DÉTAILLÉ d'incapacité de travail: chaque \
   période avec taux d'incapacité (%), dates de début et fin, \
   médecin certificateur, raison médicale. Tentatives de reprise \
   et leurs résultats. Évolution du taux d'incapacité dans le temps."""
