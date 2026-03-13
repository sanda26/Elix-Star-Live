#!/usr/bin/env bash
# Deploy Anber Live to a Hetzner server via SSH.
#
# Usage:
#   export HETZNER_HOST=deploy@123.45.67.89
#   ./scripts/deploy-to-hetzner.sh
#
# Optional: HETZNER_REPO_PATH (default: ~/anber-live or current dir name)

set -e
HOST="${HETZNER_HOST:?Set HETZNER_HOST (e.g. deploy@123.45.67.89 or deploy@anberlive.co.uk)}"
REPO_PATH="${HETZNER_REPO_PATH:-anber-live}"
REPO_PATH="${REPO_PATH/#\~/$HOME}"
if [[ "$REPO_PATH" != /* ]]; then
  REPO_PATH="$HOME/$REPO_PATH"
fi

echo "Deploying to $HOST (path: $REPO_PATH)..."

ssh -o ConnectTimeout=10 "$HOST" "set -e
  cd $REPO_PATH || { echo 'Directory not found. Clone the repo first (see docs/DEPLOYMENT_GUIDE.md).'; exit 1; }
  git pull
  docker compose build --no-cache
  docker compose up -d
  docker compose ps
  echo 'Done. Check https://your-domain/health'
"

echo "Deploy finished."
