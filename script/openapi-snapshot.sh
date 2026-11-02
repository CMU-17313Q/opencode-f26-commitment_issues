#!/usr/bin/env bash
# Starts the OpenCode server from <source-dir> with Bun and saves the OpenAPI spec it serves at
# GET /doc to <output-file>. The command mirrors the Dockerfile's CMD (same entrypoint, port, and
# --conditions=browser), but uses the headless `serve` instead of `web` so it never opens a browser.
# The spec is built from source by OpenApi.fromApi, so it matches what the deployed container serves.
# No model API keys are needed: /doc never calls the LLM.
#
# The server gets throwaway XDG dirs so it never reads or writes your real opencode config/data,
# and it is always stopped on exit so a second snapshot can reuse port 4096.
#
# Usage: script/openapi-snapshot.sh <source-dir> <output-file>
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <source-dir> <output-file>" >&2
  exit 2
fi

out="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
cd "$1"

# Otherwise our server fails to bind, the health check passes against the other one, and we save its spec.
if curl -s --max-time 2 -o /dev/null http://127.0.0.1:4096/; then
  echo "Port 4096 is already in use; stop that server first (e.g. docker compose down)" >&2
  exit 1
fi

# --ignore-scripts skips native addon builds (node-pty, tree-sitter) and Electron's download, none of
# which /doc needs; Bun still applies patchedDependencies.
if [ ! -d node_modules ]; then
  bun install --frozen-lockfile --ignore-scripts
fi

home="$(mktemp -d)"
log="${home}/server.log"
env -u OPENCODE_SERVER_PASSWORD \
  XDG_CONFIG_HOME="${home}/config" XDG_DATA_HOME="${home}/data" \
  XDG_STATE_HOME="${home}/state" XDG_CACHE_HOME="${home}/cache" \
  bun run --cwd packages/opencode --conditions=browser src/index.ts serve --hostname 127.0.0.1 --port 4096 \
  > "$log" 2>&1 &
pid=$!
# `|| true`: set -e applies inside the trap, and wait returns the killed server's 143.
trap 'kill "$pid" 2> /dev/null || true; wait "$pid" 2> /dev/null || true; rm -rf "$home"' EXIT

for i in $(seq 1 60); do
  if curl -sf --max-time 5 http://127.0.0.1:4096/global/health > /dev/null; then
    echo "Server is up after ${i} attempt(s)"
    break
  fi
  if [ "$i" -eq 60 ] || ! kill -0 "$pid" 2> /dev/null; then
    echo "Server did not become healthy" >&2
    cat "$log" >&2
    exit 1
  fi
  sleep 2
done

curl -sf --max-time 30 http://127.0.0.1:4096/doc -o "$out"

# Fail loudly if /doc served something other than an OpenAPI document.
jq -e '.openapi and .paths' "$out" > /dev/null
echo "Saved OpenAPI $(jq -r .openapi "$out") spec with $(jq '.paths | length' "$out") paths to $out"
