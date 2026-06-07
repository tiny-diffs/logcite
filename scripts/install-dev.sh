#!/usr/bin/env bash
# Link this checkout as the local `logpod` executable for development testing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v bun >/dev/null 2>&1; then
  echo "error: bun is required but was not found in PATH" >&2
  exit 1
fi

echo "→ Installing dependencies"
bun install

echo "→ Linking local package as the development logpod executable"
bun link

if ! command -v logpod >/dev/null 2>&1; then
  cat >&2 <<'MSG'
error: `logpod` was linked, but it is not available in PATH.
Make sure Bun's global bin directory is on PATH (usually ~/.bun/bin), then rerun this script.
MSG
  exit 1
fi

echo "→ logpod path: $(command -v logpod)"
echo "→ logpod version: $(logpod --version)"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
cat > "$tmp" <<'LOG'
2026-05-04T14:22:11Z INFO health probe ok 200
2026-05-04T14:22:15Z WARN pool acquire 480ms
2026-05-04T14:22:16Z ERROR psycopg2.OperationalError: connection failed
2026-05-04T14:22:20Z ERROR pool exhausted, queue=18
LOG

echo "→ Smoke testing installed executable"
logpod compress "$tmp" --stats -s api >/dev/null
logpod compress "$tmp" -s api | logpod validate - >/dev/null

echo "✓ Development executable is installed and working"
