#!/usr/bin/env bash
# Install Logcite from this checkout: CLI executable + local agent skills.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v bun >/dev/null 2>&1; then
  cat >&2 <<'MSG'
error: Bun is required to install Logcite.
Install Bun first: https://bun.sh/docs/installation
MSG
  exit 1
fi

echo "==> Installing Logcite CLI"
bash "$ROOT/scripts/install-dev.sh"

echo
echo "==> Installing Logcite agent skills"
bash "$ROOT/scripts/install-skills.sh"

echo
echo "✓ Logcite installed"
echo "  CLI:    $(command -v logcite)"
echo "  Skills: $HOME/.agents/skills/logcite-diagnose"
echo "          $HOME/.claude-code/skills/logcite-diagnose"
