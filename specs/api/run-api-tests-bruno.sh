#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
HOST="${HOST:-http://localhost:8000}"
BRUNO_SANDBOX="${BRUNO_SANDBOX:-safe}"

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
  echo "--- bun x @usebruno/cli run $folder ---"
  bun x @usebruno/cli run "$folder" --env local --env-var "host=$HOST" --sandbox "$BRUNO_SANDBOX"
done
