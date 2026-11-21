---
name: dev
description: Workflow for changing code in the Trip Insurance repository, from design to commit. Invoke on "개발", "기능 추가", "고쳐줘", or "맥락 파악".
---

# Development

A change moves from the design to the code, then through verification and review to a commit and a release.

## Workflow

1. Read `AGENTS.md`, the PRD and the tech doc.
2. A design change updates the PRD first.
3. Change the code.
4. Run the verification below.
5. Run the `simplify` agent on the diff, apply its proposals, and run the verification again.
6. Run the `code-review` agent on the diff and fix its findings.
7. Commit with a Conventional Commit message when the user asks.
8. A `feat` or `fix` commit on master opens a release PR. Merging that PR deploys the contracts to Base Sepolia and republishes the demo site.

A session without these agents applies the same reviews itself.

## Screens

```text
Wording  Plain words; KRW first, ETH small
Layout   Key information on top, full-screen views, simplicity over features
```

A screen change gets a Chrome check for wording and overflow. A change to the shared script or stylesheet bumps the cache tag on every page that loads it.

## Common

### Context notes

Volatile facts such as commands, ports and URLs live in `.context/skills/<name>/`, named after this skill. Read them first, and record any missing or stale fact from the code with the date.

### Verification

Every change ends with `forge test`, `npm run e2e` and, for screens, Chrome.
