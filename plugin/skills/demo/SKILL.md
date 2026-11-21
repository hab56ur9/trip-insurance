---
name: trip-demo
description: Prepares and runs the Trip Insurance class demo. Invoke on "시연 준비", "발표 준비", or "시연 돌려줘".
---

# Demo

The demo lets participants buy and invest from their phones while the presenter judges policies from a laptop. `docs/demo-runbook.md` holds the full order.

## Context notes

Volatile facts live in `.context/skills/trip-demo/`. Read them first. When one is missing or stale, find it in the code and record it with the date.

```text
Facts    screen URLs per network, LAN address, participant sheet, funding steps
Sources  ui/, docs/demo-runbook.md, .context/screens.md, .context/deploy.md
```

## Roles

```text
Participants  buyer and investor screens on a phone, temporary wallet
Presenter     oracle and fund screens, on the laptop only
```

## Scenarios

| Scenario | Oracle report | Result |
|---|---|---|
| On schedule | normal | Expiry; investors claim and withdraw |
| Disrupted | delay | Payout; the traveler withdraws |
