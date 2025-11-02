# 09 - Error Handling

## Dead Letter Queue (DLQ)

**Location:** `.forge/_dlq/*.jsonl`

**Purpose:** Failed operations with replay capability

**Replay:** `dlq.replay(batch_id?, filter?)`

## Incident Management

**Workflow:**
```
incident.start(payload)
→ incident.note(id, details)
→ incident.resolve(id, rca)
```

**Storage:** `.forge/_incidents/service_failure_<ts>.json`

## Retry Policy

**Retryable codes:**
- PROVIDER_RATE_LIMIT
- NETWORK_TIMEOUT
- TRANSIENT_5XX

**Non-retryable codes:**
- INVALID_CREDENTIALS
- SCHEMA_VIOLATION
- QUOTA_EXCEEDED_HARD

**Backoff:** Exponential with jitter

## Rollback Protocol

**Triggers:**
- Validation failure
- Data corruption detected
- Critical service failure

**Process:**
1. Restore to last valid version
2. Record in change_ledger
3. Capture env_config_snapshot
4. Run smoke tests
5. Link RCA document

**Approval:** Required unless AUTO_ROLLBACK=true