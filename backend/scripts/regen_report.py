"""Re-generate field_values.json from an existing dossier.json.

Usage:
    uv run python scripts/regen_report.py <dossier_uuid> [--canton fribourg]

Loads the dossier from data/dossiers/<uuid>/dossier.json, calls GPT-4o
with the current prompts, and overwrites field_values.json + rapport_ai.docx.
Useful for iterating on prompt quality without re-uploading via the UI.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

# Add backend/ to sys.path so `app.*` imports work.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.classification import store  # noqa: E402
from app.report.services import generate_report  # noqa: E402


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Re-generate report from existing dossier"
    )
    parser.add_argument(
        "dossier_id", help="UUID of the dossier (folder name under data/dossiers/)"
    )
    parser.add_argument("--canton", default="fribourg", choices=["fribourg", "geneve"])
    args = parser.parse_args()

    # Verify dossier exists before calling the LLM.
    dossier = store.get_dossier(args.dossier_id)
    if dossier is None:
        print(f"Error: dossier not found for id={args.dossier_id}")
        sys.exit(1)

    print(f"Dossier found: {args.dossier_id}")
    print(f"Canton: {args.canton}")
    print("Calling OpenAI model...")

    result = await generate_report(args.dossier_id, args.canton)

    print(f"Done — {len(result['field_values'])} fields generated")
    print(f"Saved to: data/dossiers/{args.dossier_id}/field_values.json")


if __name__ == "__main__":
    asyncio.run(main())
