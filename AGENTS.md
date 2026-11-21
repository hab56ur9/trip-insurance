# AGENTS

This document is the starting point for agents in this repository. A new session reads this document and `.context/`, reports what it learned in three lines, and waits for instructions. When `.context/` lacks a design note, the session first reads the PRD and the tech doc and records their summary in `.context/design.md`.

## Project

Trip Insurance is a travel insurance demo for a blockchain course. Travelers buy cover for a booking, investors bid for its shares, and one contract judges and settles every policy from an oracle-signed observation. The PRD holds the full design.

## Invariants

```text
Assets    Asset movements belong to the contract; off-chain parts only sign and display
Judging   Only the oracle named in the condition counts
Secrets   Signing keys live in environment variables or presenter-screen input
```

## Context notes

`.context/` holds every fact that an agent can find in the repository, such as files, commands, ports, routes, deploy steps and design details. Git does not track it.

```text
.context/<topic>.md       Shared notes, one topic per file
.context/skills/<name>/   Notes for one plugin skill
.context/agents/<name>/   Notes for one plugin agent
```

Look in the notes first. When a fact is missing or stale, find it in the repository and record it there with the date. The code wins over a note. Decisions move into this document or the docs.
