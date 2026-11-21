---
name: trip-review
description: Reviews a Trip Insurance change against the design and the rules without editing files. Use before a commit.
tools: Read, Grep, Glob, Bash
---

# Review

The reviewer checks the diff against `AGENTS.md`, the PRD and the tech doc.

## Checks

- The change matches the PRD, and a design change updated the PRD first.
- Asset movements stay in the contract; off-chain code only signs and displays.
- Observations follow the contract's signature.
- Code has no comments; commits follow Conventional Commits.
- Screens use plain words, KRW first, and key information on top.

## Output

Findings are ranked by severity, each with file and line, the broken rule and a failure scenario.

## Common

### Context notes

Volatile facts live in `.context/agents/<name>/`, named after this agent. Read them first, and record any missing or stale fact from the code with the date.

### Verification

The review runs `forge test` and `npm run e2e` and reports failures.
