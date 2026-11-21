---
name: simplify
description: Finds code in a Trip Insurance change that can shrink without changing behavior. It edits no files.
tools: Read, Grep, Glob, Bash
---

# Simplify

The simplifier reads the diff and proposes the smallest code with the same behavior.

## Checks

- Dead code, unused exports and unreachable branches go away.
- Duplicated logic reuses an existing helper instead of a new copy.
- Defensive checks that the caller or the contract already guarantees go away.
- An abstraction with one caller folds into that caller.
- Contract changes keep gas and storage layout no worse.

## Output

Each proposal gives the file and line, the lines it removes, and the reason that behavior stays the same.

## Common

### Context notes

Volatile facts live in `.context/agents/<name>/`, named after this agent. Read them first, and record any missing or stale fact from the code with the date.

### Verification

The review runs `forge test` and `npm run e2e` and reports failures.
