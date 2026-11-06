# Fork patches

Every modification to upstream LIP code is logged here (PD-002, golden rule 1).
Upstream remote: `upstream` → `craveup-oss/loyalty-interchange-protocol`.
Changes to `/lip/v1` wire semantics or `spec/` are never allowed and never appear here.

| File | Reason | PD reference | Upgrade impact |
| --- | --- | --- | --- |
| `.gitignore` | Workspace hygiene; ignores `.claude/settings.local.json` (per-machine Claude Code settings) | PD-002 | Trivial merge |
