# AGENTS

This document is the starting point for agents in the Trip Insurance repository. A new session reads this document and `.context/`, reports what it learned in three lines, and waits for instructions.

## Project

Trip Insurance is a travel insurance demo for a blockchain course. A traveler proves a booking with a cost NFT, and investors split the 100 shares of the policy in an ascending auction. The contract judges each policy from an oracle-signed observation.

```text
docs/prd.html          Requirements and the full design
docs/tech.html         Methods, limits and trade-offs
docs/demo-runbook.md   Demo order
```

## Architecture

One contract handles every policy. Asset movements belong to the contract, and the off-chain parts only sign and display.

```text
Contracts      Insurance and cost NFT, Foundry
Mock services  Booking issuer, oracle, faucet, Node
Screens        Static HTML; phone for participants, desktop for the presenter
```

A local host uses the local chain, and other hosts use Base Sepolia. A merged release PR deploys fresh contracts.

## Decided design

These decisions frame every change.

```text
Auction       Ascending pay-as-bid on coverage per share; binds whatever sold
Judging       Only the condition's oracle counts; met pays full coverage, unmet expires, no judgment voids
Settlement    2% fee; premium shared by shares; per-address credits that each party withdraws
Lazy          The first call after a deadline runs the allocation or the void
Secrets       Signing keys live in environment variables or presenter-screen input
```

```text
observation = keccak256(abi.encode(chainid, insurance, kind, subject, windowStart, windowEnd, value))
EIP-191 personal sign, recovered in the contract with ecrecover
```

## Context notes

`.context/` holds volatile facts such as files, routes, ports and deploy steps. Git does not track it.

```text
.context/<topic>.md        Shared notes, one topic per file
.context/skills/<skill>/   Notes for one plugin skill
```

Read them before work. When a fact is missing or stale, find it in the code and record it with the date. Decisions move into this document or `docs/`.

## Working rules

```text
Language       Korean answers: a three-line conclusion first, ending with "### 남은 문제"
Code           Ships without comments until the user allows them
Branch         Commit to master; end messages with a Co-Authored-By line
Commits        Conventional Commits; feat and fix trigger a release
Wording        Plain words in screens; KRW first, ETH small
Screens        Key information on top, full-screen views, simplicity over features
Design change  docs/prd.html first, then the code
Docs           README and AGENTS.md in English; README under 3,000 characters
```

## Verification

Every change ends with these commands.

```bash
export PATH="$HOME/.foundry/bin:$PATH"
forge test
npm run e2e
```

A screen change gets a Chrome check. A shared script or stylesheet change bumps the `?v=` tag.
