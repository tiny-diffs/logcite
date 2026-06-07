#!/usr/bin/env bash
# Build a standalone `logcite` binary from this checkout and install it on PATH.
#
# Installs to $LOGCITE_BIN_DIR (default ~/.local/bin). A compiled binary is used
# instead of `bun link` so the version on PATH is self-contained and updates
# cleanly in place — no stale shim can shadow it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BIN_DIR="${LOGCITE_BIN_DIR:-$HOME/.local/bin}"
TARGET="$BIN_DIR/logcite"

if ! command -v bun >/dev/null 2>&1; then
  echo "error: bun is required but was not found in PATH" >&2
  exit 1
fi

echo "→ Installing dependencies"
bun install

echo "→ Building standalone logcite binary"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
bun build src/cli.ts --compile --outfile "$tmp/logcite"

echo "→ Smoke testing the freshly built binary"
log="$tmp/sample.log"
cat > "$log" <<'LOG'
2026-05-04T14:22:11Z INFO health probe ok 200
2026-05-04T14:22:15Z WARN pool acquire 480ms
2026-05-04T14:22:16Z ERROR psycopg2.OperationalError: connection failed
2026-05-04T14:22:20Z ERROR pool exhausted, queue=18
Authorization: Bearer smoketestsecrettoken
LOG

"$tmp/logcite" compress "$log" --stats -s api >/dev/null
"$tmp/logcite" compress "$log" -s api | "$tmp/logcite" validate - >/dev/null
# scan: a custom pattern and the secrets preset (must redact, never leak).
"$tmp/logcite" scan "$log" --pattern "err=ERROR" >/dev/null
if "$tmp/logcite" scan "$log" --preset secrets | grep -q "smoketestsecrettoken"; then
  echo "error: secrets preset leaked a raw secret" >&2
  exit 1
fi

echo "→ Installing to $TARGET"
mkdir -p "$BIN_DIR"
install -m 0755 "$tmp/logcite" "$TARGET"

if ! command -v logcite >/dev/null 2>&1; then
  cat >&2 <<MSG
warning: installed to $TARGET, but \`logcite\` is not on PATH.
Add this to your shell profile, then restart your shell:
  export PATH="$BIN_DIR:\$PATH"
MSG
else
  resolved="$(command -v logcite)"
  if [[ "$resolved" != "$TARGET" ]]; then
    cat >&2 <<MSG
warning: \`logcite\` on PATH resolves to $resolved, not the binary just installed
at $TARGET. An earlier PATH entry is shadowing it — remove that copy or reorder PATH.
MSG
  fi
fi

echo "→ logcite path: $(command -v logcite)"
echo "→ logcite version: $(logcite --version)"
echo "✓ Development executable is installed and working"
