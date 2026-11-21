---
name: trip-stack
description: Starts, stops and checks the Trip Insurance local stack (local chain, contract deploy, mock services, screen server). Invoke on "스택 켜줘", "스택 재시작", "스택 상태", or "smoke".
---

# Local stack

The local stack runs a local chain, the contracts, the mock services and a screen server from the repository root.

## Context notes

Volatile facts live in `.context/skills/trip-stack/`. Read them first. When one is missing or stale, find it in the code and record it with the date.

```text
Facts    start and stop commands, ports, block time, readiness check, test counts
Sources  script/local-up.sh, services/, package.json, e2e/
```

## Rules

- The start script stays in the foreground, so it runs in the background.
- A clean chain starts only after the running stack stops.
- A change under services/ takes effect after a restart.
- The stack is ready once the mock platform API answers.
- Every change ends with `forge test` and `npm run e2e`.
