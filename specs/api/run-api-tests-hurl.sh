#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
HOST="${HOST:-http://localhost:8000}"
UID_VAL="${UID_VAL:-$(date +%s)$$}"

echo "Running Hurl tests against $HOST with uid=$UID_VAL"

FILES=("$@")
if [ ${#FILES[@]} -eq 0 ]; then
  FILES=("$DIR"/hurl/*.hurl)
fi

hurl --test \
  --error-format long \
  --jobs 1 \
  --variable "host=$HOST" \
  --variable "uid=$UID_VAL" \
  "${FILES[@]}"
