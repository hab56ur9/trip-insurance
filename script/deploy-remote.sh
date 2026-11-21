#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$PATH"

: "${RPC:?RPC (예: Sepolia RPC URL)이 필요해요}"
: "${DEPLOYER_KEY:?DEPLOYER_KEY가 필요해요}"
: "${ISSUER_KEY:?ISSUER_KEY가 필요해요}"
: "${TREASURY:?TREASURY 주소가 필요해요}"

ISSUER="$(cast wallet address --private-key "$ISSUER_KEY")"
PROFILE="${PROFILE:-demo}" ISSUER="$ISSUER" TREASURY="$TREASURY" forge script script/Deploy.s.sol \
  --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" --broadcast
echo "deployed: $(cat "deployments/$(cast chain-id --rpc-url "$RPC").json")"
echo "services: RPC=\$RPC PUBLIC_RPC=<브라우저용 RPC> ISSUER_KEY=… ORACLE_KEY=… FAUCET_KEY=… npm run services"
