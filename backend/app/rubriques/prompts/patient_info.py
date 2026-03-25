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

Ne déduis rien qui n'est pas explicitement écrit dans le dossier."""
