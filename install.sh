#!/usr/bin/env bash
# Install Logcite: CLI executable + published agent skill.
# Works from a checkout (`./install.sh`) or via curl-to-bash.
set -euo pipefail

REPO_URL="${LOGCITE_REPO_URL:-https://github.com/tiny-diffs/logcite.git}"
ARCHIVE_URL="${LOGCITE_ARCHIVE_URL:-https://codeload.github.com/tiny-diffs/logcite/tar.gz/main}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" >/dev/null 2>&1 && pwd)"

if [[ ! -f "$ROOT/scripts/install-dev.sh" || ! -f "$ROOT/scripts/install-skills.sh" ]]; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  echo "==> Downloading Logcite installer"
  if command -v git >/dev/null 2>&1; then
    git clone --depth 1 "$REPO_URL" "$tmp/logcite" >/dev/null
  elif command -v curl >/dev/null 2>&1 && command -v tar >/dev/null 2>&1; then
    mkdir -p "$tmp/logcite"
    curl -fsSL "$ARCHIVE_URL" | tar -xz -C "$tmp/logcite" --strip-components=1
  else
    echo "error: git or curl+tar is required to download Logcite" >&2
    exit 1
  fi

  bash "$tmp/logcite/install.sh"
  exit $?
fi

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
echo "  Skill:  logcite-diagnose"
echo "          installed with: npx skills add https://github.com/tiny-diffs/logcite/skills --skill logcite-diagnose"
