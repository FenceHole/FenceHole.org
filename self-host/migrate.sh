#!/usr/bin/env bash
# Loads the FenceHole schema (tables + row-level security) into the
# self-hosted Postgres. Idempotent-ish: the SQL uses "if not exists" /
# "create or replace" where it can. Run after `docker compose up -d`.
set -euo pipefail

cd "$(dirname "$0")"

# The Supabase Postgres container is named "supabase-db" in the official stack.
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-postgres}"

echo "==> Applying FenceHole schema to $DB_CONTAINER"
for f in \
  ../supabase/schema.sql \
  ../supabase/hq-schema.sql \
  ../supabase/hq-agents-v2-schema.sql \
  ../supabase/fix-rls-recursion.sql
do
  echo "    -> $(basename "$f")"
  docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$f"
done

echo "==> Schema loaded."
echo "    Create your login next:"
echo "      Open Supabase Studio (http://localhost:8000) -> Authentication ->"
echo "      Add user (Auto Confirm), then in SQL editor run:"
echo "      update public.profiles set role='team' where email='you@email.com';"
