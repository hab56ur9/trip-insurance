---
name: trip-demo
description: Runs the Trip Insurance demo locally. Invoke on "데모 해줘", "시연 준비", or "스택 켜줘".
---

# Demo

The demo runs the whole insurance flow on a local chain.

## Rules

- Install the declared toolchain and dependencies first.
- The start script runs in the background.
- A clean chain starts only after the running stack stops.
- The stack is ready once the mock platform API answers.
- Phones join over the laptop's LAN; presenter screens stay on the laptop.

## Scenarios

| Scenario | Oracle report | Result |
|---|---|---|
| On schedule | normal | Expiry; investors claim and withdraw |
| Disrupted | delay | Payout; the traveler withdraws |

## Common

### Context notes

Volatile facts such as commands, ports and URLs live in `.context/skills/<name>/`, named after this skill. Read them first, and record any missing or stale fact from the code with the date.

### Verification

Every change ends with `forge test`, `npm run e2e` and, for screens, Chrome.
