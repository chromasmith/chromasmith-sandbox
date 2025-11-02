# 06 - Verbs and Macros

## Registry Files

- `.forge/verbs.yml` - 22 atomic verbs across 7 modules
- `.forge/macros.yml` - 8 composite operations
- `.forge/triggers.yml` - 1:1 trigger mapping

## Verb Modules

1. **durability** (6 verbs) - Lock, WAL, audit
2. **run** (3 verbs) - Workflow orchestration
3. **context** (5 verbs) - Scoring, hot index
4. **incident** (3 verbs) - Incident tracking
5. **repo** (3 verbs) - CRUD operations
6. **validate** (2 verbs) - Schema validation
7. **guard** (3 verbs) - Safety enforcement

## Key Verbs

**repo.write:**
```
1. guard.enforceSafeMode()
2. validate.validateOrThrow()
3. durability.atomicWriteJson()
4. context.upsertMap()
5. durability.appendAuditLog()
```

**run.start:**
- Acquires transaction lock
- Creates run file
- Freezes context snapshot

**run.finish:**
- Releases lock (always, even on error)
- Finalizes state
- Appends ledger entry

## Macros

Macros compose multiple verbs:
- `provision_channel()` - Lazy channel provisioning
- `deploy_feature()` - Complete deployment workflow
- `publish_content()` - Content scheduling pipeline