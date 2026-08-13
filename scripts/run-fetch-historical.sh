#!/bin/bash
# Wrapper for launchd — runs the historical fetch with nvm node in scope
export PATH="/Users/mgsunroof/.nvm/versions/node/v24.15.0/bin:$PATH"

# Machine may have just woken from sleep when launchd fires this — wait for
# DNS to actually resolve before running, instead of failing immediately.
for i in $(seq 1 30); do
  dscacheutil -q host -a name firestore.googleapis.com >/dev/null 2>&1 && break
  sleep 2
done

cd /Users/mgsunroof/Documents/Corizon/Conjuncture

# dscacheutil above only proves the *system* resolver cache is warm — the
# CGD/Firestore clients can still hit DEADLINE_EXCEEDED/ENETUNREACH for tens
# of seconds after that on cold post-sleep wake. Retry the actual run, not
# just the precheck — safe since progress is checkpointed in
# .fetch-historical-state.json and each retry resumes from there.
attempt=1
max_attempts=4
until npm run fetch-historical; do
  status=$?
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "[run-fetch-historical] giving up after $attempt attempts (exit $status)"
    exit "$status"
  fi
  echo "[run-fetch-historical] attempt $attempt failed (exit $status), retrying in 30s..."
  attempt=$((attempt + 1))
  sleep 30
done
