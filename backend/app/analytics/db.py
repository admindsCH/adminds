"""SQLite-based analytics event store.

Stores user activity events in a single `analytics.db` file under `backend/data/`.
All writes are fire-and-forget — analytics must never block or break main requests.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from loguru import logger

# ── Database path ─────────────────────────────────────────

_DB_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_DB_PATH = _DB_DIR / "analytics.db"

# ── Connection (lazy singleton) ───────────────────────────

_conn: sqlite3.Connection | None = None


def _get_conn() -> sqlite3.Connection:
    """Return a module-level SQLite connection, creating the DB/table on first call."""
    global _conn
    if _conn is not None:
        return _conn

    _DB_DIR.mkdir(parents=True, exist_ok=True)
    _conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    _conn.execute("PRAGMA journal_mode=WAL")  # safe for concurrent reads
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    TEXT    NOT NULL,
            event_type TEXT    NOT NULL,
            metadata   TEXT    NOT NULL DEFAULT '{}',
            created_at TEXT    NOT NULL
        )
        """
    )
    _conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_events_user ON events (user_id, created_at)"
    )
    _conn.commit()
    logger.info(f"Analytics DB ready at {_DB_PATH}")
    return _conn


# ── Public API ────────────────────────────────────────────


def track(user_id: str, event_type: str, metadata: dict | None = None) -> None:
    """Record an analytics event. Never raises — logs errors instead."""
    try:
        conn = _get_conn()
        conn.execute(
            "INSERT INTO events (user_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?)",
            (
                user_id,
                event_type,
                json.dumps(metadata or {}, ensure_ascii=False),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()
    except Exception as e:
        logger.error(f"Analytics track error: {e}")


def get_all_events() -> list[dict]:
    """Return all events ordered by time descending."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, user_id, event_type, metadata, created_at FROM events ORDER BY created_at DESC"
    ).fetchall()
    return [
        {
            "id": r[0],
            "user_id": r[1],
            "event_type": r[2],
            "metadata": json.loads(r[3]),
            "created_at": r[4],
        }
        for r in rows
    ]


def get_user_events(user_id: str) -> list[dict]:
    """Return all events for a specific user, ordered by time descending."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, user_id, event_type, metadata, created_at FROM events WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,),
    ).fetchall()
    return [
        {
            "id": r[0],
            "user_id": r[1],
            "event_type": r[2],
            "metadata": json.loads(r[3]),
            "created_at": r[4],
        }
        for r in rows
    ]


def _compute_streaks(active_dates: list[str]) -> tuple[int, int]:
    """Compute current streak and best streak from a sorted list of date strings (YYYY-MM-DD).

    Returns (current_streak, best_streak).
    """
    if not active_dates:
        return 0, 0

    dates = sorted({date.fromisoformat(d) for d in active_dates})
    today = date.today()

    # Current streak: count consecutive days ending today (or yesterday)
    current = 0
    check = today
    # Allow streak to still count if last activity was yesterday
    if dates[-1] < today - timedelta(days=1):
        current = 0
    else:
        if dates[-1] == today - timedelta(days=1):
            check = today - timedelta(days=1)
        for d in reversed(dates):
            if d == check:
                current += 1
                check -= timedelta(days=1)
            elif d < check:
                break

    # Best streak
    best = 1
    run = 1
    for i in range(1, len(dates)):
        if dates[i] - dates[i - 1] == timedelta(days=1):
            run += 1
            best = max(best, run)
        else:
            run = 1

    return current, best


def _compute_time_spent_minutes(user_id: str, conn: sqlite3.Connection) -> dict:
    """Compute time spent from heartbeat + page_visit events.

    Groups events into sessions: a gap > 5 min between consecutive events starts a new session.
    Each event within a session counts as 1 minute of activity.

    Returns { "total_minutes": int, "today_minutes": int, "week_minutes": int }.
    """
    rows = conn.execute(
        """
        SELECT created_at FROM events
        WHERE user_id = ? AND event_type IN ('heartbeat', 'page_visit')
        ORDER BY created_at ASC
        """,
        (user_id,),
    ).fetchall()

    if not rows:
        return {"total_minutes": 0, "today_minutes": 0, "week_minutes": 0}

    timestamps = [datetime.fromisoformat(r[0]) for r in rows]
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())

    session_gap = timedelta(minutes=5)
    total = 0
    today_total = 0
    week_total = 0

    for i in range(len(timestamps)):
        if i == 0:
            # First event: count 1 minute
            minutes = 1
        else:
            diff = timestamps[i] - timestamps[i - 1]
            if diff <= session_gap:
                minutes = diff.total_seconds() / 60
            else:
                # New session: count 1 minute for session start
                minutes = 1

        total += minutes
        if timestamps[i] >= today_start:
            today_total += minutes
        if timestamps[i] >= week_start:
            week_total += minutes

    return {
        "total_minutes": round(total),
        "today_minutes": round(today_total),
        "week_minutes": round(week_total),
    }


def get_per_user_summary() -> list[dict]:
    """Return an aggregated summary per user: last seen, event counts, streaks, time spent."""
    conn = _get_conn()

    # Last seen per user (exclude heartbeat from total count)
    users = conn.execute(
        """
        SELECT user_id, MAX(created_at) as last_seen,
               SUM(CASE WHEN event_type != 'heartbeat' THEN 1 ELSE 0 END) as total_events
        FROM events
        GROUP BY user_id
        ORDER BY last_seen DESC
        """
    ).fetchall()

    summaries = []
    for user_id, last_seen, total_events in users:
        # Event counts by type
        type_counts = conn.execute(
            "SELECT event_type, COUNT(*) FROM events WHERE user_id = ? GROUP BY event_type",
            (user_id,),
        ).fetchall()

        # Daily activity (last 30 days)
        daily = conn.execute(
            """
            SELECT DATE(created_at) as day, COUNT(*) as count
            FROM events
            WHERE user_id = ?
            ORDER BY day DESC
            LIMIT 30
            """,
            (user_id,),
        ).fetchall()

        # Active dates for streak computation
        active_dates_rows = conn.execute(
            "SELECT DISTINCT DATE(created_at) FROM events WHERE user_id = ? ORDER BY DATE(created_at)",
            (user_id,),
        ).fetchall()
        active_dates = [r[0] for r in active_dates_rows]
        current_streak, best_streak = _compute_streaks(active_dates)
        days_active_30 = len([d for d in active_dates if date.fromisoformat(d) >= date.today() - timedelta(days=30)])

        # Time spent
        time_spent = _compute_time_spent_minutes(user_id, conn)

        summaries.append(
            {
                "user_id": user_id,
                "last_seen": last_seen,
                "total_events": total_events,
                "event_counts": {row[0]: row[1] for row in type_counts},
                "daily_activity": [{"date": row[0], "count": row[1]} for row in daily],
                "current_streak": current_streak,
                "best_streak": best_streak,
                "days_active_30": days_active_30,
                "time_spent": time_spent,
            }
        )

    return summaries
