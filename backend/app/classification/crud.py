from __future__ import annotations

from fastapi import HTTPException

from app.classification import store
from app.classification.schemas import (
    DossierResponse,
    PatientDossier,
    PatientDossierPatch,
)


def create_dossier(dossier: PatientDossier) -> DossierResponse:
    """Store a PatientDossier and return it with its ID."""
    dossier_id = store.create_dossier(dossier)
    return DossierResponse(dossier_id=dossier_id, dossier=dossier)


def get_dossier(dossier_id: str) -> DossierResponse:
    """Retrieve a stored dossier by ID. Raises 404 if not found."""
    dossier = store.get_dossier(dossier_id)
    if dossier is None:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    return DossierResponse(dossier_id=dossier_id, dossier=dossier)


def patch_dossier(dossier_id: str, patch: PatientDossierPatch) -> DossierResponse:
    """Apply a partial update to a stored dossier. Raises 404 if not found."""
    updated = store.update_dossier(dossier_id, patch.model_dump(exclude_unset=True))
    if updated is None:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    return DossierResponse(dossier_id=dossier_id, dossier=updated)
