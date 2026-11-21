#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$PATH"

: "${RPC:?RPC (예: https://sepolia.base.org)가 필요해요}"
DEPLOYER_KEY="${DEPLOYER_KEY:-${UNSAFE_DEMO_KEY:?DEPLOYER_KEY나 UNSAFE_DEMO_KEY가 필요해요}}"
DEMO="$(cast wallet address --private-key "$DEPLOYER_KEY")"
ISSUER="${ISSUER:-${ISSUER_KEY:+$(cast wallet address --private-key "$ISSUER_KEY")}}"
ISSUER="${ISSUER:-$DEMO}"
TREASURY="${TREASURY:-$DEMO}"
PROFILE="${PROFILE:-demo}" ISSUER="$ISSUER" TREASURY="$TREASURY" forge script script/Deploy.s.sol \
  --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" --broadcast
echo "deployed: $(cat "deployments/$(cast chain-id --rpc-url "$RPC").json")"
echo "services: RPC=\$RPC UNSAFE_DEMO_KEY=… npm run services"
