# Trip Insurance plugin

This folder is the Claude Code and Codex plugin for the Trip Insurance repository. It holds the skills and the agent that work on the repository, and the code itself lives in the parent folder.

```text
skills/demo          Runs the local demo: setup, stack, screens, scenarios
skills/dev           Workflow for changing code: design, code, verify, review, commit
agents/trip-review   Reviews a change against the design and the rules (Claude Code)
```

Each skill and agent keeps its volatile facts in `.context/` at the repository root. Agents fill those notes by exploring the code.
