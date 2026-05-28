#!/bin/bash
set -a
source /Users/mgsunroof/Documents/Conjuncture/.env.local
set +a

export PATH="/Users/mgsunroof/.nvm/versions/node/v24.15.0/bin:$PATH"

cd /Users/mgsunroof/Documents/Conjuncture
npx ts-node --project tsconfig.scripts.json scripts/refresh-statuses.ts
