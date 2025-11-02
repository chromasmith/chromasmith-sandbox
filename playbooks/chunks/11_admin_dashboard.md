# 11 - Admin Dashboard

## Status

**PARTIALLY PLANNED** - Basic health monitoring exists

## Current Implementation

**Health Status:**
- Location: `.forge/status/health.json`
- Manual entry/exit controls
- Circuit breaker state
- Violation count

## Planned Features

**System Overview:**
- Service health mesh
- Recent runs timeline
- Active incidents
- Circuit breaker status

**Audit Trail:**
- Recent operations log
- Failed operations
- DLQ contents
- Replay controls

**Context Insights:**
- Hot index entries
- Context budget usage
- Map access patterns
- Archive candidates

**Performance Metrics:**
- Operation latency (p50, p95, p99)
- Lock contention
- WAL size
- Webhook response times

## Access

Dashboard will be accessible via:
- CLI: `forge dashboard`
- Web: Local dev server
- API: REST endpoints for integrations