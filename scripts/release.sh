#!/usr/bin/env bash
set -e

BUMP=${1:-patch}

if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
    echo "Usage: ./scripts/release.sh [patch|minor|major]"
    exit 1
fi

cd "$(git rev-parse --show-toplevel)/backend"

echo "Bumping $BUMP version..."
bump-my-version bump "$BUMP"

echo "Pushing to main..."
git push origin main --follow-tags
