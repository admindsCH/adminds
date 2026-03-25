from app.rubriques.prompts._base import PREAMBLE

PROMPT = f"""\
{PREAMBLE}

TON OBJECTIF: Extraire les données démographiques et antécédents du patient.

Extrais:
- Âge du patient si mentionné
- Sexe si identifiable
- Situation sociale: état civil, enfants, emploi actuel, logement, nationalité, \
  langue maternelle, permis de séjour — tout ce qui est documenté
- Antécédents médicaux et psychiatriques significatifs (somatiques + psy): \
  maladies passées, hospitalisations, tentatives de suicide, addictions, \
  traumatismes, antécédents familiaux pertinents

Ne déduis rien qui n'est pas explicitement écrit dans le dossier."""
