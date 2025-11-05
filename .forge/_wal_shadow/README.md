# Write-Ahead Log Shadow Copy

This directory maintains a redundant copy of the WAL for additional durability.

## Purpose
- Redundancy: Protects against single-point corruption
- Recovery: Fallback if primary WAL is corrupted
- Verification: Cross-check for data integrity

## Structure
- `pending_writes.jsonl` - Shadow copy of WAL entries

## Notes
- Synchronized with primary WAL on every write
- Used for recovery validation
- Both copies must match for successful recovery
