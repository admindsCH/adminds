from app.rubriques.prompts._base import PREAMBLE

PROMPT = f"""\
{PREAMBLE}

TON OBJECTIF: Extraire les données démographiques et antécédents du patient.

Extrais:
- Âge du patient si mentionné
- Sexe si identifiable
- Situation sociale: uniquement les éléments PRÉSENTS dans le dossier \
  (état civil, enfants, emploi, logement, nationalité, etc.). \
  N'énumère pas les champs absents. Si rien n'est documenté: null.
- Antécédents médicaux et psychiatriques: uniquement ce qui EST documenté \
  (maladies passées, hospitalisations, tentatives de suicide, addictions, \
  traumatismes, antécédents familiaux). \
  N'énumère pas les absences. Si rien n'est documenté: null.

STYLE POUR SITUATION SOCIALE ET ANTÉCÉDENTS:
- Écris un texte SYNTHÉTIQUE et direct. PAS de citations de sources ("Selon...", \
  "Selon l'entrée...", "Numéro cas..."). Le médecin connaît son dossier.
- Présente les faits de manière condensée et fluide, sans répéter les références \
  documentaires. Exemple: "Patiente mariée depuis 10 ans, vit en Suisse depuis 13 ans. \
  Un processus de FIV est en cours." — PAS: "Selon le 1er entretien du 08.04.2025 \
  (Numéro cas 18446-2), la patiente..."
- Garde les dates cliniques pertinentes (dates d'événements médicaux), mais \
  supprime les métadonnées de source (numéros de cas, titres d'entrées).

Ne déduis rien qui n'est pas explicitement écrit dans le dossier."""
