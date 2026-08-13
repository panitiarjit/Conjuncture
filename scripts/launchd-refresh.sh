#!/bin/bash
set -a
source /Users/mgsunroof/Documents/Corizon/Conjuncture/.env.local
set +a

export PATH="/Users/mgsunroof/.nvm/versions/node/v24.15.0/bin:$PATH"

# Machine may have just woken from sleep when launchd fires this — wait for
# DNS to actually resolve before running, instead of failing immediately.
for i in $(seq 1 30); do
  dscacheutil -q host -a name firestore.googleapis.com >/dev/null 2>&1 && break
  sleep 2
done

cd /Users/mgsunroof/Documents/Corizon/Conjuncture

# dscacheutil above only proves the *system* resolver cache is warm — Node's
# gRPC client (c-ares) has its own resolver and keeps failing with
# "14 UNAVAILABLE: Name resolution failed" for tens of seconds after that,
# on cold post-sleep networking. Retry the actual run, not just the precheck.
attempt=1
max_attempts=4
until npx ts-node --project tsconfig.scripts.json scripts/refresh-statuses.ts; do
  status=$?
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "[launchd-refresh] giving up after $attempt attempts (exit $status)"
    exit "$status"
  fi
  echo "[launchd-refresh] attempt $attempt failed (exit $status), retrying in 30s..."
  attempt=$((attempt + 1))
  sleep 30
done
