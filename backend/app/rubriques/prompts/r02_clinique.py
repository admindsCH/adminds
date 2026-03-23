"""Prompt for R02 — Clinique (current clinical picture)."""

from app.rubriques.prompts._base import PREAMBLE

PROMPT = f"""\
{PREAMBLE}

TON OBJECTIF: Extraire la rubrique R02 — TABLEAU CLINIQUE ACTUEL.

Tu dois remplir les champs suivants avec un maximum de détails:

1. symptomes_actuels — Tableau clinique actuel complet: nature des symptômes \
   (humeur, anxiété, sommeil, appétit, libido, énergie, concentration, \
   idéations suicidaires, etc.), fréquence, intensité, retentissement sur \
   le quotidien. État mental observé lors des dernières consultations. \
   Évolution récente des symptômes.

2. constats_medicaux — Observations cliniques objectives: examen psychiatrique \
   détaillé (présentation, contact, discours, pensée, perception, cognition, \
   insight), tests neuropsychologiques, bilans somatiques, scores \
   standardisés (GAF, BDI, HAM-D, MMSE, etc.) avec dates et résultats.

3. diagnostics_incapacitants — Diagnostics CIM-10 ayant un impact sur la \
   capacité de travail. Pour chaque diagnostic: code CIM-10, description, \
   et lien explicite entre le diagnostic et les limitations fonctionnelles \
   qu'il entraîne.

4. diagnostics_sans_incidence — Diagnostics CIM-10 sans répercussion sur la \
   capacité de travail. Pour chaque diagnostic: code CIM-10, description, \
   et explication de pourquoi il n'est pas incapacitant.

5. frequence_consultations — Fréquence actuelle des consultations et du suivi \
   (ex: "1x/semaine psychothérapie, 1x/mois contrôle psychiatrique"). \
   Type de prise en charge (ambulatoire, hospitalier, de jour).

6. diagnostics — Liste structurée de TOUS les diagnostics mentionnés dans \
   le dossier. Pour chaque diagnostic: label complet, code CIM-10 si \
   présent, type (incapacitant/sans_incidence/inconnu)."""
