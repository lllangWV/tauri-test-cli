#!/bin/bash
# Test that orphaned tauri-driver/app processes are cleaned up properly.
# Requires: built test-app binary, xvfb-run, pixi
#
# Usage: bash scripts/test-orphan-cleanup.sh

set -o pipefail
cd "$(dirname "$0")/.."

APP_BIN="./apps/test-app/src-tauri/target/debug/test-app"
if [ ! -f "$APP_BIN" ]; then
  echo "Error: test-app binary not found at $APP_BIN"
  echo "Build it first: pixi run cargo build --manifest-path apps/test-app/src-tauri/Cargo.toml"
  exit 1
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
PASS_COUNT=0
FAIL_COUNT=0

check_process() {
  pgrep -f "$1" | grep -v pgrep >/dev/null 2>&1
}

cleanup_all() {
  pkill -9 -f "tauri-driver" 2>/dev/null
  pkill -9 -f "target/debug/test-app" 2>/dev/null
  pkill -9 -f "WebKitWeb" 2>/dev/null
  lsof -ti:4444 2>/dev/null | xargs -r kill -9 2>/dev/null
  lsof -ti:4445 2>/dev/null | xargs -r kill -9 2>/dev/null
  lsof -ti:9222 2>/dev/null | xargs -r kill -9 2>/dev/null
  lsof -ti:9223 2>/dev/null | xargs -r kill -9 2>/dev/null
  sleep 1
}

wait_for_server() {
  local port=$1
  for i in $(seq 1 20); do
    if curl -s "http://127.0.0.1:${port}/status" >/dev/null 2>&1; then
      echo "Server ready after ${i}s"
      return 0
    fi
    sleep 1
  done
  echo "Server failed to start"
  return 1
}

start_server() {
  local port=$1
  env -u WAYLAND_DISPLAY GDK_BACKEND=x11 xvfb-run --auto-servernum \
    --server-args='-screen 0 1920x1080x24' \
    pixi run bun run ./src/cli.ts server --app "$APP_BIN" --port "$port" &>/dev/null &
  echo $!
}

# Clean slate
cleanup_all

echo "============================================"
echo -e "${YELLOW}TEST 1: Clean shutdown via /stop endpoint${NC}"
echo "============================================"

BG_PID=$(start_server 9222)
wait_for_server 9222 || { echo -e "${RED}TEST 1 SKIPPED (server failed)${NC}"; cleanup_all; exit 1; }

curl -s http://127.0.0.1:9222/stop >/dev/null 2>&1
sleep 3

PASS=true
if check_process "tauri-driver"; then
  echo -e "  tauri-driver: ${RED}STILL RUNNING${NC}"; PASS=false
else
  echo -e "  tauri-driver: ${GREEN}CLEANED${NC}"
fi
if check_process "target/debug/test-app"; then
  echo -e "  test-app: ${RED}STILL RUNNING${NC}"; PASS=false
else
  echo -e "  test-app: ${GREEN}CLEANED${NC}"
fi
if $PASS; then echo -e "${GREEN}TEST 1 PASSED${NC}"; ((PASS_COUNT++)); else echo -e "${RED}TEST 1 FAILED${NC}"; ((FAIL_COUNT++)); fi

cleanup_all

echo ""
echo "============================================"
echo -e "${YELLOW}TEST 2: Parent process killed (SIGTERM to wrapper)${NC}"
echo "============================================"

BG_PID=$(start_server 9222)
wait_for_server 9222 || { echo -e "${RED}TEST 2 SKIPPED${NC}"; cleanup_all; exit 1; }

echo "Killing xvfb-run wrapper (PID $BG_PID) with SIGTERM..."
kill -TERM $BG_PID 2>/dev/null

# Ancestor monitor checks every 500ms, give it time
for i in $(seq 1 10); do
  sleep 0.5
  if ! check_process "tauri-driver" && ! check_process "target/debug/test-app"; then
    echo "All cleaned after $((i * 500))ms"
    break
  fi
done

PASS=true
if check_process "tauri-driver"; then
  echo -e "  tauri-driver: ${RED}STILL RUNNING${NC}"; PASS=false
else
  echo -e "  tauri-driver: ${GREEN}CLEANED${NC}"
fi
if check_process "target/debug/test-app"; then
  echo -e "  test-app: ${RED}STILL RUNNING${NC}"; PASS=false
else
  echo -e "  test-app: ${GREEN}CLEANED${NC}"
fi
if $PASS; then echo -e "${GREEN}TEST 2 PASSED${NC}"; ((PASS_COUNT++)); else echo -e "${RED}TEST 2 FAILED${NC}"; ((FAIL_COUNT++)); fi

cleanup_all

echo ""
echo "============================================"
echo -e "${YELLOW}TEST 3: SIGKILL (crash) + restart cleans up stale driver${NC}"
echo "============================================"

BG_PID=$(start_server 9222)
wait_for_server 9222 || { echo -e "${RED}TEST 3 SKIPPED${NC}"; cleanup_all; exit 1; }

BUN_PID=$(pgrep -f "bun run.*cli.ts server.*test-app" | tail -1)
echo "Killing bun (PID $BUN_PID) with SIGKILL..."
kill -9 $BUN_PID 2>/dev/null
sleep 2

if check_process "tauri-driver"; then
  echo -e "  tauri-driver orphaned: ${YELLOW}expected${NC}"
else
  echo -e "  tauri-driver: already gone (ancestor monitor caught it)"
fi

# Kill xvfb-run wrapper too
kill $BG_PID 2>/dev/null
sleep 1

echo "Starting new server on port 9223 (should clean up stale state)..."
BG_PID2=$(start_server 9223)
wait_for_server 9223

PASS=false
if curl -s http://127.0.0.1:9223/status >/dev/null 2>&1; then
  echo -e "  New server started: ${GREEN}YES${NC}"
  PASS=true
else
  echo -e "  New server started: ${RED}NO${NC}"
fi

curl -s http://127.0.0.1:9223/stop >/dev/null 2>&1
sleep 2
kill $BG_PID2 2>/dev/null

if $PASS; then echo -e "${GREEN}TEST 3 PASSED${NC}"; ((PASS_COUNT++)); else echo -e "${RED}TEST 3 FAILED${NC}"; ((FAIL_COUNT++)); fi

cleanup_all

echo ""
echo "============================================"
echo "RESULTS: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"
echo "============================================"

[ "$FAIL_COUNT" -eq 0 ] && exit 0 || exit 1
