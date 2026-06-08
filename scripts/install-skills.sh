#!/usr/bin/env bash
# Install/update Logcite's published agent skills using the skills CLI.
set -euo pipefail

SKILLS_SOURCE="${LOGCITE_SKILLS_SOURCE:-https://github.com/tiny-diffs/logcite/skills}"
SKILL="${LOGCITE_SKILL:-logcite-diagnose}"

if ! command -v npx >/dev/null 2>&1; then
  cat >&2 <<'MSG'
error: npx is required to install Logcite skills.
Install Node.js/npm first: https://nodejs.org/
MSG
  exit 1
fi

echo "→ Installing skill: $SKILL"
echo "→ Source: $SKILLS_SOURCE"
npx --yes skills add "$SKILLS_SOURCE" --skill "$SKILL"

echo "✓ Skill installed/updated: $SKILL"
