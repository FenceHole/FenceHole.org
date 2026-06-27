#!/usr/bin/env bash
# One-time setup for the self-hosted FenceHole Hub.
# Pulls the official Supabase docker stack into ./supabase and wires it up.
# Re-running is safe: it won't clobber an existing ./supabase/docker-compose.yml
# or your .env files.
set -euo pipefail

cd "$(dirname "$0")"

echo "==> 1/4  Fetching the Supabase self-hosting stack"
if [ ! -f supabase/docker-compose.yml ]; then
  tmp="$(mktemp -d)"
  git clone --depth 1 https://github.com/supabase/supabase "$tmp/supabase"
  mkdir -p supabase
  cp -r "$tmp/supabase/docker/." supabase/
  rm -rf "$tmp"
  echo "    pulled supabase/docker -> ./supabase"
else
  echo "    ./supabase already present, leaving it as-is"
fi

echo "==> 2/4  Creating env files"
if [ ! -f supabase/.env ]; then
  cp supabase/.env.example supabase/.env
  echo "    created supabase/.env  (edit POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY,"
  echo "    SERVICE_ROLE_KEY, DASHBOARD_USERNAME/PASSWORD before going live)"
else
  echo "    supabase/.env already present"
fi
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    created .env  (fill in keys — see README-SELFHOST.md)"
else
  echo "    .env already present"
fi

echo "==> 3/4  Reminder: generate your keys"
cat <<'NOTE'
    Supabase needs a JWT secret plus matching anon + service_role keys.
    Generate them at  https://supabase.com/docs/guides/self-hosting/docker
    (the "Generate API keys" box), then put:
      - JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY  -> supabase/.env
      - the same ANON_KEY / SERVICE_ROLE_KEY    -> ./.env
        (NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY)
NOTE

echo "==> 4/4  Done. Next steps:"
echo "    1. Edit supabase/.env and ./.env with your keys (above)."
echo "    2. docker compose up -d            # boots Postgres, Auth, Studio, app"
echo "    3. ./migrate.sh                    # loads the FenceHole tables + RLS"
echo "    4. Open http://localhost:3000      # the Hub"
