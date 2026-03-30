"""Clerk webhook handler — sends Slack notifications on new user signup."""

from __future__ import annotations

import hashlib
import hmac

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from loguru import logger

from app.config import settings

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _verify_clerk_signature(
    payload: bytes,
    svix_id: str,
    svix_timestamp: str,
    svix_signature: str,
) -> bool:
    """Verify the Svix signature sent by Clerk webhooks.

    Clerk uses Svix under the hood. The signature is HMAC-SHA256 of
    ``{svix_id}.{svix_timestamp}.{payload}`` using the webhook secret
    (base64-decoded, after stripping the ``whsec_`` prefix).
    """
    import base64

    secret = settings.clerk_webhook_secret
    if not secret:
        logger.warning("CLERK_WEBHOOK_SECRET not set — skipping verification")
        return True

    # Clerk prefixes the secret with "whsec_"
    if secret.startswith("whsec_"):
        secret = secret[6:]
    key = base64.b64decode(secret)

    msg = f"{svix_id}.{svix_timestamp}.{payload.decode()}".encode()
    expected = hmac.new(key, msg, hashlib.sha256).digest()
    expected_b64 = base64.b64encode(expected).decode()

    # svix_signature is a space-separated list like "v1,<sig1> v1,<sig2>"
    for sig in svix_signature.split(" "):
        parts = sig.split(",", 1)
        if len(parts) == 2 and hmac.compare_digest(parts[1], expected_b64):
            return True
    return False


@router.post("/clerk")
async def clerk_webhook(
    request: Request,
    svix_id: str = Header(None),
    svix_timestamp: str = Header(None),
    svix_signature: str = Header(None),
) -> dict:
    """Handle Clerk webhook events. Sends Slack notification on user.created."""
    payload = await request.body()

    # Verify signature if secret is configured
    if settings.clerk_webhook_secret:
        if not svix_id or not svix_timestamp or not svix_signature:
            raise HTTPException(status_code=400, detail="Missing Svix headers")
        if not _verify_clerk_signature(
            payload, svix_id, svix_timestamp, svix_signature
        ):
            raise HTTPException(status_code=401, detail="Invalid signature")

    event = await request.json()
    event_type = event.get("type", "")

    if event_type == "user.created":
        await _handle_user_created(event.get("data", {}))

    return {"status": "ok"}


async def _handle_user_created(data: dict) -> None:
    """Send a Slack message when a new user signs up."""
    first = data.get("first_name") or ""
    last = data.get("last_name") or ""
    name = f"{first} {last}".strip() or "Inconnu"

    emails = data.get("email_addresses", [])
    email = emails[0]["email_address"] if emails else "—"

    logger.info(f"New user created: {name} ({email})")

    if not settings.slack_webhook_url:
        logger.warning("SLACK_WEBHOOK_URL not set — skipping Slack notification")
        return

    message = {
        "text": f":tada: Nouvel utilisateur inscrit sur Adminds !\n*{name}* — {email}",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(settings.slack_webhook_url, json=message, timeout=10)
        if resp.status_code != 200:
            logger.error(f"Slack webhook failed ({resp.status_code}): {resp.text}")
        else:
            logger.info(f"Slack notification sent for new user: {name}")
