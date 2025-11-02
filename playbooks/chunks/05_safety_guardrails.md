# 05 - Safety Guardrails

## Schema Validation

**Location:** `.forge/_schema/`

**Integration:** Blocks writes at repo.write() level

**Required Fields:**
- `id` (kebab-case)
- `created_at` (ISO 8601)
- `updated_at` (ISO 8601)
- `status` (draft|active|archived|deleted)

## Safe Mode

**Health File:** `.forge/status/health.json`

**Modes:**
- `healthy` - Read/write allowed
- `read_only` - Writes blocked

**Enforcement:** All write-class verbs call `guard.enforceSafeMode()` before execution

## Circuit Breaker

**Threshold:** Opens after 3 consecutive failures

**Reset:** Automatic on successful operation

**Action:** Auto-enters safe-mode when circuit opens

## Adaptive Enforcement

**Levels:**
- 0 violations → WARN
- 1-2 violations → SOFT_BLOCK (override possible)
- 3+ violations → HARD_BLOCK (strict)

**Recording:** `healthMesh.recordViolation(reason)`

## Preflight Checks

Run before operations:
- Schema validation
- Permissions check
- Secrets hygiene
- Drift sniffers
- Dependency CVE scan
- UTC skew check