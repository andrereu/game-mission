# CLAUDE.md — Project State Governance

Use `PROJECT_STATE_GOVERNANCE.md` as a mandatory governance layer for structural work.

## Before work
- Read the project's Canonical Current State in Notion.
- Inspect `main` plus relevant registered branches.
- Search for prior approved brand/assets/architecture before creating replacements.
- Treat CANONICAL / DO NOT REDESIGN / DO NOT REBUILD / PRESERVE as hard project constraints unless the user explicitly changes them.

## During work
- Prefer adapting approved work over recreating it.
- Avoid blind merges from old branches; transplant only the intended files/changes.
- Preserve traceability to branch/commit and key assets.

## Closeout
Return a concise structured report containing:
- phase/status
- branch
- commit
- files changed
- tests/build
- deploy status
- decisions approved
- canonical constraints
- pending items
- exact next step

If Notion access is available, update the canonical state directly. Otherwise, provide a Notion-ready closeout block.
