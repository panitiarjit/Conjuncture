#!/bin/bash
# Wrapper for launchd — runs the historical fetch with nvm node in scope
export PATH="/Users/mgsunroof/.nvm/versions/node/v24.15.0/bin:$PATH"
cd /Users/mgsunroof/Documents/Conjuncture
npm run fetch-historical >> /tmp/fetch-historical.log 2>&1
