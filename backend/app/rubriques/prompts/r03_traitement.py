from app.rubriques.prompts._base import PREAMBLE

PROMPT = f"""\
{PREAMBLE}

TON OBJECTIF: Extraire la rubrique R03 — TRAITEMENT.

Tu dois remplir les champs suivants avec un maximum de détails:

1. medication — Traitement médicamenteux actuel COMPLET: pour chaque \
   médicament, le nom, le dosage exact, la posologie, la date \
   d'introduction, l'indication. Traitements passés: nom, dosage, \
   durée, raison d'arrêt (inefficacité, effets secondaires, etc.). \
   Effets secondaires actuels si documentés. Observance thérapeutique.

2. plan_traitement — Plan de traitement en cours et proposé: \
   psychothérapie (type: TCC, psychodynamique, EMDR, etc.; fréquence; \
   objectifs), pharmacothérapie (ajustements envisagés), mesures de \
   réadaptation proposées, autres interventions (ergothérapie, \
   activités thérapeutiques, groupes). Cohérence du plan avec les \
   diagnostics posés.

3. pronostic — Évolution attendue: arguments cliniques pour et contre \
   une amélioration, durée estimée de l'incapacité, facteurs \
   influençant le pronostic (compliance, comorbidités, soutien social, \
   chronicité des troubles). Pronostic à court terme et à long terme.

4. medications — Liste structurée de TOUS les médicaments mentionnés \
   dans le dossier (actuels ET passés). Pour chaque médicament: nom, \
   dosage si mentionné, date de prescription si connue."""
