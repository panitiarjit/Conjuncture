#!/bin/bash
set -a
source /Users/mgsunroof/Documents/Conjuncture/.env.local
set +a

export PATH="/Users/mgsunroof/.nvm/versions/node/v24.15.0/bin:$PATH"

# Machine may have just woken from sleep when launchd fires this — wait for
# DNS to actually resolve before running, instead of failing immediately.
for i in $(seq 1 30); do
  dscacheutil -q host -a name firestore.googleapis.com >/dev/null 2>&1 && break
  sleep 2
done

cd /Users/mgsunroof/Documents/Conjuncture
npx ts-node --project tsconfig.scripts.json scripts/refresh-statuses.ts
