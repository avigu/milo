#!/bin/bash
# /data/.openclaw/workspace/container-startup.sh

echo "Starting permanent background services..."

# 1. Start VS Code Server (using our stable wrapper)
/data/.openclaw/workspace/start-code-server.sh > /data/.openclaw/workspace/code-server.log 2>&1 &

# 2. Start the Invest Coach Dashboard
cd /data/.openclaw/workspace/invest-coach-web
PORT=8080 npm run dev > /data/.openclaw/workspace/nextjs.log 2>&1 &

echo "Services initiated."
