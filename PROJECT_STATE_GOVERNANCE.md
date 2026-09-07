# Project State Governance — Canonical State Protocol

## Purpose

Prevent approved decisions, branches, brand directions, architecture choices, assets, and implementation state from being lost inside chat history.

This protocol is designed to be shared by ChatGPT/Work, Codex, Claude/Claude Code, and human collaborators.

## Source-of-truth hierarchy

1. **GitHub / repository** — truth of versioned code and files.
2. **Notion** — truth of decisions, canonical state, constraints, and handoffs.
3. **Production / deploy** — truth of what is actually live.
4. **Chats** — working space only; never the sole durable source of an important decision.
5. **Local files / archives** — physical source only when explicitly referenced from the canonical project state.

## Session start rule

Before structural work:

1. Read the project's **Canonical Current State** in Notion.
2. Inspect the repository default branch and relevant parallel branches.
3. Look for decisions marked:
   - CANONICAL
   - DO NOT REDESIGN
   - DO NOT REBUILD
   - PRESERVE
4. Compare the current request with those decisions.
5. If Notion and GitHub disagree, investigate before overwriting anything.

## Automatic closeout rule

At the end of every relevant round, update the canonical state without waiting for the user to remember to ask.

Record:

- Date and phase
- What was decided / approved
- Status: completed / partial / blocked / pending
- Working branch
- Relevant commit(s)
- Key files/components
- Deploy/URL when applicable
- Canonical constraints
- Real pending items
- Exact next step
- Risks / discoveries the next agent must know

## Canonical state template

```text
CANONICAL STATE — YYYY-MM-DD
Phase: X.Y — name
Status: active | completed | blocked
Main branch: ...
Working branch: ...
Canonical commit: ...
Deploy: ...

APPROVED / PRESERVE
- ...

DO NOT REBUILD / DO NOT REDESIGN
- ...

PENDING
- ...

NEXT STEP
- ...
```

## Parallel branch rule

No important branch may remain unregistered.

For each structural branch, record:

- branch name
- purpose
- reference commit
- status: active / merged / historical / discarded
- whether it contains an approved asset or decision not yet in `main`

Before creating something new, search for an already-approved implementation in parallel branches.

## Canonical decision labels

When something must not be reinvented, explicitly mark it:

- **CANONICAL**
- **DO NOT REDESIGN**
- **DO NOT REBUILD**
- **PRESERVE**

These labels take precedence over later aesthetic suggestions or refactors unless the user explicitly changes the decision.

## Multi-agent handoff

Every handoff should include:

- current state
- canonical Notion page
- repository and branch
- relevant commits
- key files
- approved decisions
- what must not be changed
- exact next task
- validation criteria

## Relevance threshold

Do not log trivial micro-edits.

Always log changes involving:

- brand / visual direction
- architecture
- business rules
- data or integrations
- approved UX
- asset selection
- phase status
- branches/commits that become future references

## Final principle

**An important decision is only truly complete when it is implemented where applicable and recorded in the project's canonical state.**
