#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$PATH"

RPC="${RPC:-http://127.0.0.1:8545}"
BLOCK_TIME="${BLOCK_TIME:-12}"
HOST=127.0.0.1
if [ "${LAN:-0}" = 1 ]; then HOST=0.0.0.0; fi
DEPLOYER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
TREASURY=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
ISSUER=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

for port in "${PLATFORM_PORT:-8787}" "${ORACLE_PORT:-8788}"; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    echo "port $port is already in use; stop the running services before redeploying" >&2
    exit 1
  fi
done

if ! cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
  anvil --host "$HOST" --block-time "$BLOCK_TIME" --silent &
  trap 'kill $!' EXIT
  until cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; do sleep 0.2; done
fi

PROFILE=local TREASURY=$TREASURY ISSUER=$ISSUER forge script script/Deploy.s.sol \
  --rpc-url "$RPC" --private-key $DEPLOYER_KEY --broadcast --silent
echo "deployed: $(cat deployments/31337.json)"
echo "screens:  python3 -m http.server 8099 --bind $HOST  →  http://127.0.0.1:8099/ui/buyer.html · investor.html · oracle.html"

SERVICE_HOST="$HOST" BLOCK_TIME="$BLOCK_TIME" node services/run.js
