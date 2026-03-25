from app.rubriques.prompts._base import PREAMBLE

PROMPT = f"""\
{PREAMBLE}

TON OBJECTIF: Extraire la rubrique R06 — RÉADAPTATION.

Tu dois remplir les champs suivants avec un maximum de détails:

1. potentiel — Aptitude aux mesures de réadaptation professionnelle: \
   motivation du patient, capacité d'apprentissage observée, \
   adaptabilité, ouverture au changement. Avis du thérapeute \
   sur les chances de succès d'une réadaptation.

2. obstacles — Obstacles à la réadaptation: facteurs médicaux \
   (symptômes invalidants, effets secondaires de la médication), \
   facteurs sociaux (isolement, barrière linguistique, situation \
   familiale), facteurs motivationnels (démoralisation, perte de \
   confiance, bénéfices secondaires). Pour chaque obstacle: \
   nature, sévérité, réversibilité.

3. ressources — Ressources mobilisables: compétences professionnelles \
   transférables, formation et diplômes, soutien familial et social, \
   capacités résiduelles, intérêts, motivation résiduelle. \
   Ce sur quoi une réadaptation pourrait s'appuyer.

4. taches_menageres — Capacité pour les tâches ménagères: ménage, \
   préparation des repas, courses, lessive, soins corporels, \
   gestion administrative. Pour chaque domaine: capacité \
   (autonome, avec aide, impossible), limitations spécifiques.

5. facteurs_environnementaux — Facteurs environnementaux pertinents: \
   type de logement, entourage (famille, amis, voisins), accès aux \
   soins et transports, situation financière, dettes, aide sociale. \
   Impact de ces facteurs sur la capacité fonctionnelle."""
