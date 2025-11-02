# 04 - Durability Layer

## Write-Ahead Log (WAL)

**Location:** `.forge/_wal/pending_writes.jsonl`

**Purpose:** Atomic index rebuilds with file lock and checksums

**Operations:**
- Append-only writes
- fsync on every write
- CRC32 checksum per record
- File lock during transactions

## Transaction Lock

**Location:** `.forge/_wal/transaction.lock`

**Critical:** Only ONE transaction lock exists system-wide
- Non-reentrant (cannot acquire while holding)
- 250ms polling interval
- 5-minute stale detection
- Auto-release on process exit

## Audit Log

**Location:** `.forge/audit.jsonl`

**Features:**
- Append-only
- Hash chain (each entry references previous hash)
- Nightly signed digest verification
- Tamper detection

## Idempotency

**Key Algorithm:**
```
sha256(ns=ff6.4 + source_event_id + payload + target_scope + monotonic_seq)
```

**Scopes:**
- events_ledger
- mcp_operations
- infrastructure_provisioning

## Migration System

**Location:** `.forge/_migrations/`

**Triggers:**
- Startup (compare MIGRATION_LOG.md)
- Schema digest change
- Manual via dashboard/CLI

**Policy:** Fail-closed until migrations complete