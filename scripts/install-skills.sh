#!/usr/bin/env bash
# Install/update this project's skills into local agent skill directories.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/skills"

if [[ ! -d "$SRC" ]]; then
  echo "error: skills directory not found: $SRC" >&2
  exit 1
fi

TARGETS=(
  "$HOME/.agents/skills"
  "$HOME/.claude-code/skills"
)

skill_name() {
  local file="$1"
  local name
  name="$(awk -F: '/^name:[[:space:]]*/ { value=$2; sub(/^[[:space:]]*/, "", value); sub(/[[:space:]]*$/, "", value); print value; exit }' "$file")"
  if [[ -z "$name" ]]; then
    basename "$(dirname "$file")"
  else
    printf '%s\n' "$name"
  fi
}

copy_skill() {
  local source_dir="$1"
  local target_root="$2"
  local name="$3"
  local dest="$target_root/$name"

  mkdir -p "$target_root"
  if command -v rsync >/dev/null 2>&1; then
    mkdir -p "$dest"
    rsync -a --delete "$source_dir/" "$dest/"
  else
    rm -rf "$dest"
    mkdir -p "$dest"
    cp -R "$source_dir/." "$dest/"
  fi
  echo "✓ $name → $dest"
}

found=0
for source_dir in "$SRC"/*; do
  [[ -d "$source_dir" ]] || continue
  [[ -f "$source_dir/SKILL.md" ]] || continue
  found=1
  name="$(skill_name "$source_dir/SKILL.md")"
  echo "→ Installing skill: $name"
  for target in "${TARGETS[@]}"; do
    copy_skill "$source_dir" "$target" "$name"
  done
done

if [[ "$found" -eq 0 ]]; then
  echo "error: no skills with SKILL.md found under $SRC" >&2
  exit 1
fi

echo "✓ Skills installed/updated"
