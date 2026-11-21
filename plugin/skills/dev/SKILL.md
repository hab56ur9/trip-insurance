---
name: trip-dev
description: Rules for changing code in the Trip Insurance repository. Invoke at session start, or on "맥락 파악", "이 레포 설명", or "어디를 고쳐야".
---

# Development

The Trip Insurance repository holds one insurance contract, mock services that only sign, and static screens. `AGENTS.md` holds the decided design and the working rules.

## Context notes

Volatile facts live in `.context/skills/trip-dev/`. Read them first. When one is missing or stale, find it in the code and record it with the date.

```text
Facts    file map, shared screen modules, cache tags, test counts
Sources  src/, services/, ui/, e2e/, .context/structure.md
```

## Rules

- Read `AGENTS.md`, `docs/prd.html` and `docs/tech.html` first.
- A design change updates `docs/prd.html` first, then the code.
- Asset movements belong to the contract; off-chain parts only sign and display.
- Code ships without comments.
- Every change ends with `forge test` and `npm run e2e`, plus Chrome for screens.
