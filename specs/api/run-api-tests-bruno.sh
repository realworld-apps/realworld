#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
HOST="${HOST:-http://localhost:8000}"

echo "Running Bruno tests against $HOST"

FOLDERS=("$@")
if [ ${#FOLDERS[@]} -eq 0 ]; then
  for entry in "$DIR"/bruno/*/; do
    name="$(basename "$entry")"
    [ "$name" = "environments" ] && continue
    FOLDERS+=("$name")
  done
fi

cd "$DIR/bruno"

for folder in "${FOLDERS[@]}"; do
  echo ""
  echo "--- bru run $folder ---"
  bru run "$folder" --env local --env-var "host=$HOST"
done
