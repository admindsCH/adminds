"""Clerk JWT authentication dependency for FastAPI.

Validates Bearer tokens issued by Clerk using their JWKS endpoint.
Usage in routes: `user: CurrentUser = Depends(get_current_user)`
"""

from __future__ import annotations

import time

import httpx
import jwt
from fastapi import Header, HTTPException
from loguru import logger
from pydantic import BaseModel

from app.config import settings


class CurrentUser(BaseModel):
    user_id: str


# ── JWKS cache ──────────────────────────────────────────

_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0.0
_JWKS_TTL = 300  # 5 minutes


def _get_jwks() -> dict:
    """Fetch Clerk's JWKS, cached for 5 minutes."""
    global _jwks_cache, _jwks_fetched_at

    if _jwks_cache and (time.time() - _jwks_fetched_at) < _JWKS_TTL:
        return _jwks_cache

    url = f"https://{settings.clerk_domain}/.well-known/jwks.json"
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    _jwks_cache = resp.json()
    _jwks_fetched_at = time.time()
    return _jwks_cache


def _get_signing_key(token: str, jwks_data: dict) -> jwt.PyJWK:
    """Match the token's ``kid`` header to the correct JWK."""
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    keyset = jwt.PyJWKSet.from_dict(jwks_data)
    for key in keyset.keys:
        if key.key_id == kid:
            return key
    raise jwt.exceptions.PyJWKError(f"Key with kid '{kid}' not found in JWKS")


def _decode_token(token: str) -> dict:
    """Decode and verify a Clerk JWT. Retries with fresh JWKS on failure."""
    jwks = _get_jwks()

    try:
        key = _get_signing_key(token, jwks)
        return jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=f"https://{settings.clerk_domain}",
            options={"require": ["sub", "exp", "iss"]},
        )
    except (jwt.exceptions.InvalidSignatureError, jwt.exceptions.PyJWKError):
        # Key might have rotated — force refresh and retry once
        global _jwks_cache
        _jwks_cache = None
        jwks = _get_jwks()
        key = _get_signing_key(token, jwks)
        return jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=f"https://{settings.clerk_domain}",
            options={"require": ["sub", "exp", "iss"]},
        )


# ── FastAPI dependency ──────────────────────────────────


async def get_current_user(
    authorization: str | None = Header(None, alias="Authorization"),
) -> CurrentUser:
    """Extract and validate Clerk JWT from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization[7:]
    try:
        payload = _decode_token(token)
    except jwt.exceptions.PyJWTError as e:
        logger.error(f"Auth failed: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing sub claim")

    return CurrentUser(user_id=user_id)
