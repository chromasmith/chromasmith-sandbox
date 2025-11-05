# Forge Flow 7.0 - Troubleshooting Runbook

## Common Issues by Module

### forge-guard Issues

#### Safe Mode Blocking Operations
**Symptom**: Operations rejected with "Safe mode enabled"
**Cause**: forge-guard protection active without confirmation token
**Solution**:
```javascript
// Provide confirmation token
const result = await guardedOperation({
  confirmationToken: 'user-confirmed-action',
  data: { ... }
});
```

#### Schema Validation Failures
**Symptom**: "Schema validation failed" errors
**Cause**: Data doesn't match expected schema
**Diagnosis**:
```bash
# Check logs for validation details
tail -f forge-guard/logs/combined.log | grep "validation"
```
**Solution**: Fix data structure or update schema definition

### forge-cairns Issues

#### WAL Lock Contention
**Symptom**: "transaction.lock file exists" errors
**Cause**: Stale lock from crashed process or concurrent writes
**Diagnosis**:
```bash
# Check for lock file
ls -la forge-cairns/data/wal/transaction.lock

# Check if process is actually running
ps aux | grep forge-cairns
```
**Solution**:
```bash
# If no process is running, remove stale lock
rm forge-cairns/data/wal/transaction.lock

# Restart service
pm2 restart forge-cairns
```

#### WAL Corruption
**Symptom**: Cannot read WAL entries, "invalid JSON" errors
**Cause**: Incomplete writes or disk issues
**Diagnosis**:
```bash
# Check WAL integrity
tail -20 forge-cairns/data/wal/operations.log
```
**Solution**:
```bash
# Backup corrupted WAL
mv forge-cairns/data/wal/operations.log \
   forge-cairns/data/wal/operations.log.corrupt.$(date +%s)

# Restore from backup if available
cp forge-cairns/data/wal/operations.log.backup \
   forge-cairns/data/wal/operations.log

# Or start fresh (data loss)
&gt; forge-cairns/data/wal/operations.log
```

#### Idempotency Cache Issues
**Symptom**: Duplicate operations not detected
**Cause**: Cache cleared or never initialized
**Solution**:
```javascript
// Force cache rebuild
const cairns = require('./forge-cairns');
cairns.rebuildCache();
```

### forge-view Issues

#### Preview Not Loading
**Symptom**: Blank screen or 404 on preview URL
**Cause**: Component not registered or Ladle server not running
**Diagnosis**:
```bash
# Check Ladle process
ps aux | grep ladle

# Check preview URL
curl http://localhost:[ladle-port]/preview/ComponentName
```
**Solution**:
```bash
# Restart Ladle
npm run ladle

# Verify component registration
ls -la src/components/*.stories.jsx
```

#### Hot Reload Not Working
**Symptom**: Changes not reflected in preview
**Cause**: File watcher not detecting changes or forge-pulse not publishing
**Diagnosis**:
```bash
# Check file watcher
tail -f forge-view/logs/combined.log | grep "file change"

# Check pulse messages
curl http://localhost:9001/pulse/stats
```
**Solution**:
```bash
# Restart forge-pulse subscriber
# Force refresh in browser
# Check file permissions for watched directories
```

#### Channel Registration Failed
**Symptom**: "Channel not found" errors
**Cause**: forge-pulse not initialized or channel name mismatch
**Solution**:
```javascript
// Re-register channel
const pulse = require('./forge-pulse');
pulse.createChannel('component-updates');
```

### forge-pulse Issues

#### Message Not Delivered
**Symptom**: Subscribers not receiving messages
**Cause**: Channel not created or subscriber not registered
**Diagnosis**:
```bash
# List active channels
curl http://localhost:9001/pulse/channels

# List subscribers
curl http://localhost:9001/pulse/subscribers
```
**Solution**:
```javascript
// Verify channel exists
pulse.createChannel('updates');

// Re-register subscriber
pulse.subscribe('updates', callbackFn);
```

#### Memory Leak from Unsubscribed Handlers
**Symptom**: Memory usage grows over time
**Cause**: Subscribers not cleaned up properly
**Solution**:
```javascript
// Always unsubscribe when done
const unsubscribe = pulse.subscribe('updates', handler);
// Later...
unsubscribe();
```

### forge-health Issues

#### Circuit Breaker Stuck Open
**Symptom**: Operations blocked even though service recovered
**Cause**: Circuit breaker not reset after recovery
**Diagnosis**:
```bash
# Check breaker state
curl http://localhost:9001/breakers
```
**Solution**:
```bash
# Manual reset
curl -X POST http://localhost:9001/breakers/reset \
  -H "Content-Type: application/json" \
  -d '{"name":"api-call"}'
```

#### Heartbeat Timeout
**Symptom**: "Service not responding" alerts
**Cause**: Service crashed or network issues
**Diagnosis**:
```bash
# Check last heartbeat
curl http://localhost:9001/heartbeat/forge-dashboard

# Check service status
pm2 status
```
**Solution**:
```bash
# Restart service
pm2 restart forge-dashboard

# Check logs for crash reason
pm2 logs forge-dashboard --lines 50
```

#### Health Endpoint Returns 500
**Symptom**: Health check fails
**Cause**: Dependent service down or module error
**Diagnosis**:
```bash
# Get detailed health status
curl http://localhost:9001/health?verbose=true
```
**Solution**: Fix the failing dependency shown in verbose output

### forge-tendrils Issues

#### Webhook HMAC Verification Failed
**Symptom**: "Invalid signature" errors, webhook rejected
**Cause**: Wrong secret or signature format mismatch
**Diagnosis**:
```bash
# Check webhook logs
tail -f forge-tendrils/logs/combined.log | grep "signature"

# Verify secret configured
grep WEBHOOK_SECRET .env
```
**Solution**:
```bash
# Regenerate webhook secret in GitHub
# Update .env file
WEBHOOK_SECRET=new-secret-here

# Restart webhook receiver
pm2 restart forge-tendrils
```

#### Git Pull Failures
**Symptom**: Webhook received but code not updated
**Cause**: Git authentication issues or merge conflicts
**Diagnosis**:
```bash
# Check git status
cd /path/to/repo
git status

# Check webhook logs
tail -f forge-tendrils/logs/combined.log | grep "git pull"
```
**Solution**:
```bash
# Fix git authentication
git config credential.helper store

# Resolve conflicts manually
git pull --rebase origin main

# Or force clean pull
git fetch origin
git reset --hard origin/main
```

#### Webhook Port Already in Use
**Symptom**: "Address already in use" on port 9002
**Cause**: Another process using the port or stale process
**Diagnosis**:
```bash
# Find process using port
lsof -i :9002
# Or on Windows
netstat -ano | findstr :9002
```
**Solution**:
```bash
# Kill process
kill -9 [PID]

# Or change port in .env
WEBHOOK_PORT=9012
pm2 restart forge-tendrils
```

### forge-dashboard Issues

#### Dashboard Not Accessible
**Symptom**: Cannot connect to port 9000
**Cause**: Service not started or port conflict
**Diagnosis**:
```bash
# Check if running
pm2 list | grep forge-dashboard

# Check port
netstat -an | grep 9000
```
**Solution**:
```bash
# Start service
pm2 start forge-dashboard

# Or change port
PORT=9010 node forge-dashboard/index.cjs
```

#### Metrics Not Updating
**Symptom**: Stale data in dashboard
**Cause**: forge-pulse not delivering updates or subscribers disconnected
**Diagnosis**:
```bash
# Check pulse stats
curl http://localhost:9001/pulse/stats

# Check dashboard logs
tail -f forge-dashboard/logs/combined.log
```
**Solution**:
```bash
# Restart dashboard
pm2 restart forge-dashboard

# Verify pulse channels
curl http://localhost:9001/pulse/channels
```

## Context Loading Failures

#### Module Import Errors
**Symptom**: "Cannot find module" errors
**Cause**: Missing dependencies or incorrect paths
**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Verify module exists
ls -la forge-[module]/index.cjs
```

#### Circular Dependency
**Symptom**: "Module not defined" or "undefined" exports
**Cause**: Modules importing each other
**Solution**: Refactor to use forge-core as intermediary

## DLQ Replay Procedures

#### View Dead Letter Queue
```bash
# List failed operations
curl http://localhost:9001/dlq/list
```

#### Replay Single Entry
```bash
curl -X POST http://localhost:9001/dlq/replay \
  -H "Content-Type: application/json" \
  -d '{"id":"dlq-entry-id"}'
```

#### Replay All
```bash
curl -X POST http://localhost:9001/dlq/replay-all
```

#### Purge DLQ
```bash
curl -X DELETE http://localhost:9001/dlq/purge
```

## Log Locations

```
forge-dashboard/logs/
  ├── combined.log    # All log levels
  ├── error.log       # Errors only
  └── access.log      # HTTP requests

forge-health/logs/
  ├── combined.log
  └── error.log

forge-tendrils/logs/
  ├── combined.log
  └── error.log

forge-cairns/data/wal/
  └── operations.log  # WAL entries
```

## Health Check Interpretation

### Status Codes
- `200 OK`: All services healthy
- `503 Service Unavailable`: One or more services down
- `500 Internal Server Error`: Health check itself failed

### Response Format
```json
{
  "status": "ok",
  "uptime": 12345,
  "modules": ["core", "guard", "cairns", "pulse", "health"],
  "breakers": {
    "api-call": {"state": "closed", "failures": 0}
  },
  "heartbeats": {
    "forge-dashboard": {"lastSeen": 1234567890}
  }
}
```

## Emergency Procedures

### Complete System Restart
```bash
# Stop all services
pm2 stop all

# Clear all locks
rm -f forge-cairns/data/wal/*.lock

# Restart in order
pm2 start forge-health
sleep 2
pm2 start forge-dashboard
sleep 2
pm2 start forge-tendrils
```

### Reset to Clean State
```bash
# DESTRUCTIVE: Clears all runtime data
rm -rf forge-cairns/data/wal/*
rm -rf forge-dashboard/logs/*
rm -rf forge-health/logs/*
rm -rf forge-tendrils/logs/*

# Restart
pm2 restart all
```

### Emergency Shutdown
```bash
# Quick kill all services
pm2 kill

# Or manual
pkill -9 -f "forge-"
```

## Support Escalation

1. Check this troubleshooting guide first
2. Review logs in module-specific log directories
3. Check GitHub Issues for known problems
4. Contact: chromasmith1@gmail.com
