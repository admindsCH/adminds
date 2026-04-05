"""Admin-only analytics endpoints.

Access is restricted to a hardcoded list of admin Clerk user IDs.
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.analytics.db import (
    get_all_events,
    get_per_user_summary,
    get_user_events,
    track,
)
from app.auth import CurrentUser, get_current_user

router = APIRouter(prefix="/admin/analytics", tags=["analytics"])

# ── Admin guard ───────────────────────────────────────────

ADMIN_USER_IDS = {
    "user_3Af5l4EYpIW94urqgVbtX9dQUNK",
    "user_3AfGjH8PKMVnlv5gyDnMKVKAoG1",
    "user_3AepyhdzQBxM9XXIu4SFUsuLeeL",
}


async def require_admin(
    user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """Dependency that rejects non-admin users with 403."""
    if user.user_id not in ADMIN_USER_IDS:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── Routes ────────────────────────────────────────────────


@router.get("/summary")
async def analytics_summary(user: CurrentUser = Depends(require_admin)) -> list[dict]:
    """Per-user summary: last seen, event counts, daily activity."""
    return get_per_user_summary()


@router.get("/events")
async def analytics_events(user: CurrentUser = Depends(require_admin)) -> list[dict]:
    """Raw event log (most recent first)."""
    return get_all_events()


@router.get("/events/{target_user_id}")
async def analytics_user_events(
    target_user_id: str,
    user: CurrentUser = Depends(require_admin),
) -> list[dict]:
    """Events for a specific user."""
    return get_user_events(target_user_id)


@router.post("/track")
async def track_event(
    event: dict,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Track an event from the frontend (e.g. page_visit).

    Body: { "event_type": "page_visit", "metadata": { "page": "/dashboard" } }
    """
    event_type = event.get("event_type")
    if not event_type:
        raise HTTPException(status_code=400, detail="event_type is required")
    metadata = event.get("metadata", {})
    track(user.user_id, event_type, metadata)
    return {"ok": True}


@router.post("/feedback")
async def submit_feedback(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Submit feedback after report generation.

    Body: { "rating": 1-5, "comment": "...", "template_name": "..." }
    """
    rating = body.get("rating")
    if not isinstance(rating, int) or not 1 <= rating <= 5:
        raise HTTPException(status_code=400, detail="rating must be 1-5")

    comment = body.get("comment", "")
    template_name = body.get("template_name", "")

    track(user.user_id, "report_feedback", {
        "rating": rating,
        "comment": comment,
        "template_name": template_name,
    })

    # Send Slack notification
    await _notify_feedback_slack(user.user_id, rating, comment, template_name)

    return {"ok": True}


async def _notify_feedback_slack(
    user_id: str, rating: int, comment: str, template_name: str
) -> None:
    """Send feedback notification to Slack."""
    from app.config import settings

    if not settings.slack_webhook_url:
        return

    stars = "\u2b50" * rating
    msg = f"{stars} Feedback *{rating}/5* de `{user_id}`"
    if template_name:
        msg += f" sur *{template_name}*"
    if comment:
        msg += f"\n> {comment}"

    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                settings.slack_webhook_url, json={"text": msg}, timeout=10
            )
    except Exception:
        pass  # Never block on Slack failures
