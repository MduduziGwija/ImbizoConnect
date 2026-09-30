#!/usr/bin/env bash
# © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE.
# Runs supabase/schema.sql and the permission/workflow checks against a throwaway database.
#   PGHOST=/tmp PGPORT=5432 PGUSER=postgres bash tests/db/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
db="imbizo_test_$$"
createdb "$db"
trap 'dropdb --if-exists "$db"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$db" -f tests/db/supabase-stubs.sql
PGOPTIONS="-c client_min_messages=warning" psql -q -v ON_ERROR_STOP=1 -d "$db" -f supabase/schema.sql
PGOPTIONS="-c client_min_messages=warning" psql -q -v ON_ERROR_STOP=1 -d "$db" -f supabase/schema.sql   # running it twice must be safe
psql -v ON_ERROR_STOP=1 -d "$db" -f tests/db/schema.test.sql | tail -3
