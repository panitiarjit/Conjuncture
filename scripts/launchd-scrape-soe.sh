#!/bin/bash
set -a
source /Users/mgsunroof/Documents/Conjuncture/.env.local
set +a

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

cd /Users/mgsunroof/Documents/Conjuncture/bidsight_scraper
python3 run_all.py --days 30
