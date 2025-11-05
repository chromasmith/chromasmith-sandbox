# Forge Flow 7.0 - Troubleshooting Guide

## Common Issues by Module

### forge-guard

**Issue: Safe mode blocking writes**
```bash
# Check safe mode status
cat .forge/status/health.json | jq '.safe_mode'

# Disable safe mode (if appropriate)
echo '{"safe_mode":"off"}' > .forge/status/health.json
```

**Issue: Schema validation failures**
```bash
# Check schema directory
ls -la .forge/_schema/

# Validate schema format
node -e "console.log(JSON.parse(require('fs').readFileSync('.forge/_schema/map_schemas/project.json')))"
```

**Issue: Confirmation token expired**
- Tokens expire after 10 minutes
- Request new token via guard.confirm.request()
- Check token cache: `.forge/status/guard_tokens.json`

### forge-cairns

**Issue: WAL lock stuck**
```bash
# Check lock file
cat .forge/_wal/transaction.lock

# If stale (>5 minutes), force release
rm .forge/_wal/transaction.lock

# Verify WAL integrity
node -e "const fs=require('fs'); console.log(fs.readFileSync('.forge/_wal/pending_writes.jsonl','utf8').split('\n').filter(l=>l).length + ' entries')"
```

**Issue: Idempotency key collisions**
```bash
# Check events ledger for duplicates
grep "idempotency_key" .forge/events_ledger.jsonl | sort | uniq -d

# Reset monotonic sequence (DANGER: only if needed)
echo '{"monotonic_seq":0}' > .forge/status/seq.json
```

**Issue: Atomic write failures**
- Check disk space: `df -h`
- Check permissions: `ls -la .forge/`
- Review error logs: `tail -100 .forge/status/logs/cairns.log`

### forge-view

**Issue: Channel not responding**
```bash
# Check channel registry
cat .forge/status/channel_registry.json | jq '.'

# Test channel endpoints
curl http://localhost:5173/
curl http://localhost:5174/

# Restart Ladle services
pm2 restart chromasmith-sandbox-ladle
```

**Issue: Preview URL 404**
- Verify branch matches channel pattern (dev→1, feature/*→2)
- Check component exists: `ls -la components/`
- Review webhook logs: `tail -50 ~/.forge/status/logs/webhook.log`

**Issue: Git pull failures**
```bash
# Check working tree status
cd ~/chromasmith-sandbox
git status

# Reset if needed
git reset --hard origin/dev
git clean -fd

# Verify webhook listener
curl http://localhost:9000/health
```

### forge-pulse

**Issue: Messages not delivered**
```bash
# Check in-memory queue
node -e "const pulse=require('./forge-pulse/index.cjs'); console.log(pulse.getQueueStats())"

# Verify subscribers
grep "subscriber" .forge/status/logs/pulse.log
```

**Issue: Channel isolation broken**
- Restart Pulse service
- Clear queue: Delete `.forge/status/pulse_queue.json`
- Verify separation in logs

### forge-health

**Issue: Heartbeat failures**
```bash
# Check health status
curl http://localhost:9002/health | jq '.'

# Review heartbeat logs
tail -50 .forge/status/logs/health.log

# Restart health service
pm2 restart forge-health
```

**Issue: Circuit breaker stuck OPEN**
```bash
# Check breaker states
curl http://localhost:9002/api/breakers | jq '.'

# Manual reset (if appropriate)
node -e "const h=require('./forge-health/index.cjs'); h.resetBreaker('api-call')"
```

### forge-build

**Issue: ForgeView stub not responding**
```bash
# Check stub health
curl http://localhost:3000/health

# Verify build artifacts
ls -la .forge/preview.json

# Review build logs
tail -100 .forge/status/logs/build.log
```

**Issue: Component registration failures**
- Check component file exists
- Verify import paths
- Review registration logs in build.log

## Lock Diagnostics

### Check Lock Status
```bash
# View current lock
cat .forge/_wal/transaction.lock

# Check lock age
stat -c %Y .forge/_wal/transaction.lock

# Current timestamp
date +%s
```

### Force Lock Release (CAUTION)
```bash
# Only if lock >5 minutes old and no active processes
rm .forge/_wal/transaction.lock

# Verify no processes holding lock
ps aux | grep "forge-"
```

## Safe Mode Troubleshooting

### Enter Safe Mode Manually
```bash
echo '{"safe_mode":"read_only","reason":"manual","timestamp":"'$(date -Iseconds)'"}' > .forge/status/health.json
```

### Exit Safe Mode
```bash
echo '{"safe_mode":"off","timestamp":"'$(date -Iseconds)'"}' > .forge/status/health.json

# Verify services recognize change
curl http://localhost:9002/health | jq '.safe_mode'
```

## Circuit Breaker Reset

### Check All Breakers
```bash
curl http://localhost:9002/api/breakers
```

### Reset Specific Breaker
```bash
curl -X POST http://localhost:9002/api/breakers/reset \
  -H "Content-Type: application/json" \
  -d '{"breaker_id":"api-call"}'
```

## Webhook Debugging

### Verify HMAC Signature
```bash
# Check webhook secret
cat ~/.forge/_policy/secrets.json | jq '.github_webhook_secret'

# Test signature generation
echo -n "payload" | openssl dgst -sha256 -hmac "YOUR_SECRET"
```

### Review Webhook Logs
```bash
tail -100 ~/.forge/status/logs/webhook.log | grep "ERROR"
tail -100 ~/.forge/status/logs/webhook.log | grep "signature"
```

### Test Webhook Manually
```bash
curl -X POST http://localhost:9000/webhook \
  -H "X-Hub-Signature-256: sha256=VALID_SIGNATURE" \
  -H "X-GitHub-Event: push" \
  -H "Content-Type: application/json" \
  -d '{"ref":"refs/heads/dev","repository":{"name":"chromasmith-sandbox"}}'
```

## Context Loading Failures

### Check Context Budget
```bash
# Review context policy
cat .forge/_policy/context.json | jq '.'

# Check trio size
wc -c .forge/context/project_fingerprint.json
wc -c .forge/context/map_index_with_triggers.json
wc -c .forge/_session/active_intent.json
```

### Context Soft-Landing Triggered
- Tier 1 (1501-1650 tokens): Metadata dropped
- Tier 2 (1651-1800 tokens): Aggressive pruning
- Review: `.forge/status/logs/context.log`

## DLQ Replay Procedures

### Check DLQ Status
```bash
# Count failed operations
cat .forge/_dlq/*.jsonl | wc -l

# View recent failures
tail -20 .forge/_dlq/*.jsonl | jq '.'
```

### Replay Single Item
```bash
node forge-cairns/dlq-replay.cjs --id=OPERATION_ID
```

### Replay Batch
```bash
node forge-cairns/dlq-replay.cjs --batch --filter='{"module":"forge-build"}'
```

## Port Conflicts

### Check Port Usage
```bash
lsof -i :9000
lsof -i :9001
lsof -i :9002
lsof -i :9003
```

### Kill Process on Port
```bash
lsof -ti :9003 | xargs kill -9
```

## Log Locations

- Webhook: `~/.forge/status/logs/webhook.log`
- Health: `.forge/status/logs/health.log`
- Cairns: `.forge/status/logs/cairns.log`
- Build: `.forge/status/logs/build.log`
- Pulse: `.forge/status/logs/pulse.log`
- Dashboard: `.forge/status/logs/dashboard.log`

## Health Check Interpretation

### Status Codes
- `healthy`: All systems operational
- `degraded`: Some non-critical failures
- `unhealthy`: Critical system failure
- `unknown`: Health check failed

### Module Health
```bash
curl http://localhost:9003/api/health | jq '.modules[] | select(.status != "healthy")'
```

## Emergency Recovery

### Full System Reset (NUCLEAR OPTION)
```bash
# Stop all services
pm2 stop all

# Clear locks
rm .forge/_wal/transaction.lock

# Reset health
echo '{"safe_mode":"off"}' > .forge/status/health.json

# Clear DLQ (optional)
rm .forge/_dlq/*.jsonl

# Restart services
pm2 restart all

# Verify
curl http://localhost:9000/health
curl http://localhost:9003/api/health
```
