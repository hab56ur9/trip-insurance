# AGENTS

This document is the starting point for agents working in the Trip Insurance repository. A new session reads this document and `.context/`, reports what it learned in three lines, and waits for instructions.

## Project

Trip Insurance is a single-trip travel insurance PoC where anyone can buy cover and anyone can become an investor. A traveler proves a booking with a cost NFT and requests a policy with a premium and a minimum coverage. Investors split the 100 shares of one policy through an ascending auction. The contract judges each policy from an observation signed by an oracle, and no person intervenes after binding.

```text
Nature    Final project for a blockchain course (implementation, presentation, live demo)
```

## Read first

```text
docs/prd.html          Requirements: joining, auction, judging, settlement
docs/tech.html         Architecture and, per requirement, the method, limits and trade-offs
docs/demo-runbook.md   Demo order
.context/              Volatile notes such as the file layout, routes, APIs and environment variables (local only)
```

## Architecture

The repository has four parts. One contract handles every policy, and the off-chain parts only sign and display; they never decide asset movements.

```text
Contracts       Insurance (join, bid, allocate, judge, void, claim, withdraw) and the cost NFT, tested with Foundry
Mock services   Booking issuer (mints cost NFTs), oracle (signs and submits observations), local faucet; Node
Screens         Participant, investor and buyer screens use a phone layout; presenter screens (oracle, fund) use a desktop layout; static HTML
Demo support    GitHub Pages (slide deck and demo screens) and a Google Sheet behind Apps Script that collects participants
```

Screens pick the network from the host that serves them. A local or private-network host uses the chain that the local services report. Any other host, such as GitHub Pages, uses the committed public-chain settings.

```text
Development        Local anvil with the mock services
Merge to master    GitHub Pages deploys the slide deck at the root and the demo screens on Base Sepolia (84532)
Release            release-please keeps a release PR open; merging it deploys fresh contracts to Base Sepolia, commits the new addresses and redeploys Pages
Presenter screens  Open only on the presenter's laptop; they are not published to Pages
```

## Decided design

```text
Join            Premium, cost NFT, coverage condition (oracle, observed item, threshold), minimum coverage
Auction         100 shares; start price = minimum coverage / 100; ascending bids on coverage per share; full deposit; highest first (earlier bid wins ties); pay-as-bid; binds whatever sold; no shares sold means cancelled; 200 bids per policy
Judging         Only the condition's oracle signature counts; condition met means payout of the full coverage, not met means expiry, no judgment within the window means void
Settlement      2% fee; premium share in proportion to shares; credits per address and each party withdraws; investors claim refunds and payouts
Lazy execution  After the bidding deadline the first judge, claim or bind call allocates; after the judging window the first claim voids; screens compute the current status
Out of scope    Coverage caps, secondary trading, investment pools, multi-trip bundles, real issuers, real oracles
Demo joining    A participant scans the QR, enters a name, gets a temporary browser wallet and registers its address in the sheet. The presenter sends ETH from the fund screen; participants never pull it
Secrets         No signing key lives in the repository. Public-chain keys come only from environment variables or presenter-screen input, and the demo uses a dedicated wallet
```

## Signature

```text
observation = keccak256(abi.encode(chainid, insurance, kind, subject, windowStart, windowEnd, value))
EIP-191 personal sign, recovered in the contract with ecrecover
```

## Working rules

```text
Language       Answers to the user are in Korean: a three-line conclusion first, ending with "### 남은 문제" (a quote line and an options table, recommended option first)
Code           Ships without comments; comments come only after the work is done and the user allows them
Branch         Commit directly to master and end commit messages with a Co-Authored-By line
Commits        Conventional Commits (feat:, fix:, docs:, chore:) so release-please can build the release PR; feat and fix trigger a release
Wording        Plain words in the screens: investor, traveler, lowest; amounts in KRW first with ETH small
Screens        Only the information that matters, important information at the top, full-screen views instead of modals, simplicity over new features
Design change  Update docs/prd.html first, then the code
Docs           README and AGENTS.md are in English. README stays under 3,000 characters with an introduction and infographics; the infographics are SVGs built from the doc diagrams into docs/diagrams/
```

## .context/

`.context/` is an agent notes folder that git does not track. Agents keep volatile information there that the code already holds but that takes effort to find each time, one Markdown file per topic, and update it as soon as it changes.

```text
structure.md   Files and folders and the role of each
screens.md     Screen routes, the wallet query and the network selection rule
services.md    Mock service APIs, ports and environment variables
deploy.md      Public-chain deployment, the Pages build and the participant sheet
```

When a note disagrees with the code, the code wins. Long-lived information such as a decision moves into this document or into docs/.

## Verification

Run these after every change.

```bash
export PATH="$HOME/.foundry/bin:$PATH"
forge test
npm run e2e
```

After a screen change, open it in Chrome and check the wording and any overflow. After a change to the shared script or stylesheet, bump the `?v=` tag on the pages.
