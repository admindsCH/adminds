"""File-based dossier store.

Each dossier gets a folder: backend/data/dossiers/{uuid}/
  - dossier.json  — serialized PatientDossier
  - rapport_ai.docx — generated report (saved after generation)
  - field_values.json — LLM-generated field values used to fill the report

Replaces the old in-memory dict so dossiers survive server restarts.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from uuid import uuid4
from app.classification.schemas import PatientDossier


_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


# Root directory for all dossier data, next to the app/ package.
_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "dossiers"


def _dossier_dir(dossier_id: str) -> Path:
    """Return the folder path for a given dossier UUID."""
    if not _UUID_RE.match(dossier_id):
        raise ValueError(f"Invalid dossier ID: {dossier_id}")
    return _DATA_DIR / dossier_id


def _dossier_path(dossier_id: str) -> Path:
    """Return the JSON file path for a given dossier."""
    return _dossier_dir(dossier_id) / "dossier.json"


def create_dossier(dossier: PatientDossier) -> str:
    """Store a dossier as JSON on disk and return its UUID."""
    dossier_id = str(uuid4())
    folder = _dossier_dir(dossier_id)
    # Create the folder (and parents like data/dossiers/ on first run).
    folder.mkdir(parents=True, exist_ok=True)
    # Write the dossier as JSON.
    _dossier_path(dossier_id).write_text(
        dossier.model_dump_json(indent=2), encoding="utf-8"
    )
    return dossier_id


def get_dossier(dossier_id: str) -> PatientDossier | None:
    """Read a dossier from disk. Returns None if not found."""
    path = _dossier_path(dossier_id)
    if not path.exists():
        return None
    return PatientDossier.model_validate_json(path.read_text(encoding="utf-8"))


def update_dossier(dossier_id: str, patch: dict) -> PatientDossier | None:
    """Apply a partial update to a stored dossier and write back to disk.

    Merge logic:
    - Dict fields (patient_info): merge keys.
    - Nested dict fields (rubriques): deep-merge two levels (rubrique → sub-fields).
    - Scalar fields (notes): replace.

    Returns the updated dossier, or None if not found.
    """
    existing = get_dossier(dossier_id)
    if existing is None:
        return None

    current = existing.model_dump()

    for key, value in patch.items():
        if value is None:
            continue
        if key == "rubriques" and isinstance(value, dict):
            # Deep-merge two levels: rubriques.r01_historique.antecedents etc.
            for rub_key, rub_value in value.items():
                if rub_value is None:
                    continue
                if isinstance(rub_value, dict) and isinstance(
                    current.get(key, {}).get(rub_key), dict
                ):
                    current[key][rub_key] = {
                        **current[key][rub_key],
                        **{k: v for k, v in rub_value.items() if v is not None},
                    }
                else:
                    current.setdefault(key, {})[rub_key] = rub_value
        elif isinstance(value, dict) and isinstance(current.get(key), dict):
            # Shallow merge for flat dicts (patient_info)
            current[key] = {
                **current[key],
                **{k: v for k, v in value.items() if v is not None},
            }
        else:
            # Lists and scalars: replace entirely
            current[key] = value

    updated = PatientDossier.model_validate(current)
    # Write the updated dossier back to disk.
    _dossier_path(dossier_id).write_text(
        updated.model_dump_json(indent=2), encoding="utf-8"
    )
    return updated


def save_debug(dossier_id: str, filename: str, data: str | dict | list) -> Path:
    """Save a debug artifact to the dossier's debug/ subfolder.

    Accepts a string (written as-is) or a dict/list (written as JSON).
    Returns the file path.
    """
    folder = _dossier_dir(dossier_id) / "debug"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / filename
    if isinstance(data, str):
        path.write_text(data, encoding="utf-8")
    else:
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    return path


def save_field_values(dossier_id: str, field_values: dict) -> Path:
    """Save the LLM-generated field values alongside the dossier.

    Returns the file path for logging/reference.
    """
    folder = _dossier_dir(dossier_id)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / "field_values.json"
    path.write_text(
        json.dumps(field_values, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return path


def get_field_values(dossier_id: str) -> dict | None:
    """Read stored field values from disk. Returns None if not found."""
    path = _dossier_dir(dossier_id) / "field_values.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def save_report(dossier_id: str, docx_bytes: bytes) -> Path:
    """Save a generated .docx report to the dossier's folder.

    Returns the file path for logging/reference.
    """
    folder = _dossier_dir(dossier_id)
    folder.mkdir(parents=True, exist_ok=True)
    report_path = folder / "rapport_ai.docx"
    report_path.write_bytes(docx_bytes)
    return report_path
