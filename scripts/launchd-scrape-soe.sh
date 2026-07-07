#!/bin/bash
set -a
source /Users/mgsunroof/Documents/Conjuncture/.env.local
set +a

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

# Machine may have just woken from sleep when launchd fires this — wait for
# DNS to actually resolve before running, instead of silently returning 0
# records from every source.
for i in $(seq 1 30); do
  dscacheutil -q host -a name google.com >/dev/null 2>&1 && break
  sleep 2
done

cd /Users/mgsunroof/Documents/Conjuncture/bidsight_scraper
python3 run_all.py --days 30
