# 07 - Forge Map Editing

## Conversational Editing

All Forge Map edits occur via MCP against GitHub with atomic commits.

## MCP Tools Used

- `read_file` - Read current content
- `str_replace` - Edit existing files
- `create_file` - Create new files
- `search_in_files` - Find content
- `get_diff` - Preview changes
- `commit` - Atomic commit

## Safety Confirmation

Required before:
- Multiple file modifications (≥2 files)
- Schema changes
- Migration changes
- Infrastructure changes

## Plan Gate

**Artifact:** `.forge/context/DRAFT_PLAN.md`

**Must include:**
- Intent summary
- Affected files (new/modified/deleted)
- Inline diffs
- MCP verb/macro sequence
- Safety checks and warnings

**Flow:**
```
generate_draft_plan()
→ require_ack(approve|modify|explain|cancel)
→ on_approve: execute_plan_atomically()
→ archive to .forge/context/_executed/
```

## Cross-Reference Validation

After edits, verify:
- All link() source/dest IDs exist
- Circular references ≤ depth 2
- No orphaned maps
- Channel references match registry