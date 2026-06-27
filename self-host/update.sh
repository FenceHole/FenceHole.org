#!/usr/bin/env bash
# Pull the latest code from your Mac's pushes and rebuild just the Hub app.
# Run this ON THE SERVER whenever you want to ship an update.
# Supabase keeps running untouched; only the app container is rebuilt.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Rebuilding and restarting the Hub app"
cd self-host
docker compose up -d --build hub

echo "==> Updated. If you changed any SQL, also run: ./migrate.sh"
