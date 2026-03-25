from app.rubriques.prompts._base import PREAMBLE

PROMPT = f"""\
{PREAMBLE}

TON OBJECTIF: Extraire la rubrique R08 — LIMITATIONS FONCTIONNELLES ET ACTIVITÉS.

Tu dois remplir les champs suivants avec un maximum de détails:

1. limitations_fonctionnelles — Limitations fonctionnelles concrètes \
   découlant des diagnostics: ce que le patient ne peut plus faire, \
   dans quelles circonstances, avec quelle intensité. Lien explicite \
   entre chaque diagnostic et les limitations qu'il entraîne. \
   Impact sur les activités de la vie quotidienne et professionnelle.

2. activites_possibles — Activités encore réalisables malgré les \
   limitations. Pour CHAQUE type d'activité suivant, préciser si \
   le patient peut l'exercer (oui / non / fluctuant) avec justification:
   - Contact clientèle / public
   - Travail autonome sans supervision
   - Endurance physique (station debout/assise prolongée)
   - Précision / travail minutieux
   - Tolérance au stress et aux délais
   - Rapidité d'exécution
   - Adaptation permanente à de nouvelles tâches
   - Tâches complexes nécessitant planification

3. capacite_conduire — Capacité de conduire un véhicule: le patient \
   conduit-il actuellement? Doutes éventuels et raisons (médication \
   sédative, troubles de l'attention, crises de panique, alcool/drogues). \
   Avis médical sur l'aptitude à la conduite si documenté."""
