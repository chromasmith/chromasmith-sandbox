# Write-Ahead Log Directory

This directory stores pending write operations before they are committed to the main data store.

## Purpose
- Durability: Ensures no data loss during crashes
- Atomicity: Groups related writes into transactions
- Recovery: Enables automatic replay on restart

## Structure
- `pending_writes.jsonl` - Active WAL entries
- `transaction.lock` - Distributed lock file

## Maintenance
- Auto-cleared after successful commits
- Replayed on service startup if non-empty
- Monitor for growth (indicates incomplete transactions)
