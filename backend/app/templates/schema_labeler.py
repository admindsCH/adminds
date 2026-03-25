"""Schema labeler — LLM Pass 1.

Takes raw slots from the XML parser and uses GPT to assign semantic
labels, field IDs, sections, hints, and rubrique mappings.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from langchain_core.messages import HumanMessage, SystemMessage
from loguru import logger

from app.services.azure_openai import ainvoke_throttled, get_model
from app.templates.schemas import RawSlot, SchemaField, TemplateSchema

# ── Rubrique keys (for the LLM to reference) ────────────

RUBRIQUE_KEYS = [
    "r01_historique",
    "r02_clinique",
    "r03_traitement",
    "r04_professionnel",
    "r05_capacite_travail",
    "r06_readaptation",
    "r07_freins_cognition",
    "r08_activites",
]

# ── System prompt for slot labeling ──────────────────────

_LABELING_SYSTEM_PROMPT = """\
Tu es un expert en formulaires médicaux suisses pour l'assurance invalidité (AI).

On te donne une liste de champs détectés automatiquement dans un formulaire \
de rapport médical (.docx ou .pdf). Pour chaque champ, tu reçois:
- Son index (slot_index)
- Son type détecté (text, date, checkbox, select_one, choice)
- Du contexte textuel environnant (texte autour du champ dans le document)
- Pour select_one/choice: les options disponibles

Ta tâche: pour CHAQUE champ, retourner un objet JSON avec:
- "id": un identifiant snake_case unique et descriptif (ex: "diagnostic_principal", "date_derniere_consultation")
- "label": un libellé humain en français (ex: "Diagnostic principal")
- "section": le nom de la section du formulaire (ex: "Informations générales", "Situation médicale", "Capacité de travail")
- "section_number": le numéro de la section tel qu'il apparaît dans le document (ex: "1", "2.2", "3.1"). Si le document n'a pas de numérotation visible, laisser une chaîne vide "".
- "hint": une instruction courte pour l'IA qui remplira ce champ (ex: "Date au format DD.MM.YYYY", "Résumer les symptômes actuels")
- "mapped_rubrique": la rubrique du dossier patient qui alimente ce champ, parmi:
  {rubriques}
  Mettre null si le champ n'est pas lié à une rubrique (ex: nom du médecin, date de signature).

IMPORTANT:
- Les "id" doivent être uniques. Si deux champs sont similaires, différencie-les (ex: "incapacite_pct_1", "incapacite_pct_2").
- Utilise le contexte pour deviner le sens du champ même si le texte est vague.
- Pour les champs de type "choice" (grilles Oui/Non), l'id doit refléter la question de la ligne.
- Sois concis dans les hints (max 100 caractères).

Retourne un JSON: {{"fields": [...]}} où chaque élément a les clés: id, label, section, section_number, hint, mapped_rubrique.
L'ordre doit correspondre exactement à l'ordre des champs en entrée.
"""


# ── Public API ───────────────────────────────────────────


async def label_slots(
    raw_slots: list[RawSlot],
    template_name: str,
) -> TemplateSchema:
    """Label raw slots semantically using GPT.

    Args:
        raw_slots: Output of schema_extractor.extract_raw_slots().
        template_name: Human name of the template (for context).

    Returns:
        A complete TemplateSchema with labeled fields and generated addendum.
    """
    if not raw_slots:
        return TemplateSchema(
            template_id="",
            template_name=template_name,
            fields=[],
            extracted_at=datetime.now(timezone.utc).isoformat(),
        )

    # Build the prompt with all slots
    prompt = _build_labeling_prompt(raw_slots, template_name)

    logger.info(f"Labeling {len(raw_slots)} slots for template '{template_name}'")

    # Call LLM in JSON mode
    model = get_model(model_kwargs={"response_format": {"type": "json_object"}})
    response = await ainvoke_throttled(
        model,
        [
            SystemMessage(
                content=_LABELING_SYSTEM_PROMPT.format(
                    rubriques="\n  ".join(f"- {k}" for k in RUBRIQUE_KEYS),
                )
            ),
            HumanMessage(content=prompt),
        ],
    )

    # Parse response
    try:
        result = json.loads(response.content)
    except json.JSONDecodeError as e:
        logger.error(f"LLM returned invalid JSON during labeling: {e}")
        result = {"fields": []}
    labels = result.get("fields", [])

    if len(labels) != len(raw_slots):
        logger.warning(
            f"LLM returned {len(labels)} labels for {len(raw_slots)} slots. "
            "Padding/truncating to match."
        )

    # Merge position data from raw slots with semantic labels from LLM
    fields: list[SchemaField] = []
    for i, raw in enumerate(raw_slots):
        if i < len(labels):
            label_data = labels[i]
        else:
            label_data = {
                "id": f"field_{i}",
                "label": f"Champ {i}",
                "section": "inconnu",
                "section_number": "",
                "hint": "",
                "mapped_rubrique": None,
            }

        fields.append(
            SchemaField(
                id=label_data.get("id", f"field_{i}"),
                slot_type=raw.slot_type,
                position=raw.position,
                field_type=raw.detected_field_type,
                label=label_data.get("label", f"Champ {i}"),
                section=label_data.get("section", "inconnu"),
                section_number=label_data.get("section_number", ""),
                hint=label_data.get("hint", ""),
                options=raw.options,
                original_text=raw.original_text,
                choice_columns=raw.choice_columns,
                mapped_rubrique=label_data.get("mapped_rubrique"),
            )
        )

    # Ensure unique IDs
    _deduplicate_ids(fields)

    logger.info(
        f"Labeled {len(fields)} fields across "
        f"{len(set(f.section for f in fields))} sections"
    )

    return TemplateSchema(
        template_id="",  # set by caller
        template_name=template_name,
        fields=fields,
        extracted_at=datetime.now(timezone.utc).isoformat(),
    )


# ── Prompt builder ───────────────────────────────────────


def _build_labeling_prompt(
    raw_slots: list[RawSlot],
    template_name: str,
) -> str:
    """Build the human message listing all raw slots for the LLM."""
    lines = [
        f"Formulaire: {template_name}",
        f"Nombre de champs détectés: {len(raw_slots)}",
        "",
        "Liste des champs:",
        "",
    ]

    for i, slot in enumerate(raw_slots):
        parts = [
            f"[{i}] type={slot.detected_field_type}",
            f"slot={slot.slot_type}",
        ]
        # For PDF fields, include the AcroForm field name — very useful for labeling
        if slot.slot_type == "pdf_field" and "field_name" in slot.position:
            parts.append(f'field_name="{slot.position["field_name"]}"')
        if slot.options:
            parts.append(f"options={slot.options}")
        if slot.original_text:
            parts.append(f'original_text="{slot.original_text}"')
        parts.append(f'context="{slot.context}"')
        lines.append(" | ".join(parts))

    return "\n".join(lines)



# ── Helpers ──────────────────────────────────────────────


def _deduplicate_ids(fields: list[SchemaField]) -> None:
    """Ensure all field IDs are unique by appending suffixes."""
    seen: dict[str, int] = {}
    for f in fields:
        if f.id in seen:
            seen[f.id] += 1
            f.id = f"{f.id}_{seen[f.id]}"
        else:
            seen[f.id] = 0
