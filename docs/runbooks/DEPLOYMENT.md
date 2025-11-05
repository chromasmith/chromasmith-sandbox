# Forge Flow 7.0 - Deployment Runbook

## Prerequisites

- **Node.js**: v22+ required
- **Ports Available**: 9000-9003 (Dashboard, Health, Webhook, reserved)
- **Git**: Repository access for webhook pulls
- **PM2** (optional): For production process management

## Module Architecture

```
forge-dashboard   → Port 9000 (Web UI)
forge-health      → Port 9001 (Monitoring)
forge-tendrils    → Port 9002 (Webhook receiver)
forge-view        → Ladle dev server (port assigned by Vite)
```

## Port Assignments

| Service | Port | Purpose |
|---------|------|---------|
| Dashboard | 9000 | Admin UI and metrics |
| Health | 9001 | Heartbeat and circuit breaker registry |
| Webhook | 9002 | GitHub webhook receiver (HMAC verified) |
| Reserved | 9003 | Future expansion |

## Setup Sequence

### 1. Clone and Install

```bash
git clone https://github.com/chromasmith/chromasmith-sandbox.git
cd chromasmith-sandbox
git checkout forge-flow-7.0-mvp
npm install
```

### 2. Module-by-Module Setup

#### forge-core
```bash
# No startup required - utility library
# Provides shared functions for all modules
```

#### forge-speak
```bash
# No startup required - logging library
# Used by all modules for structured logging
```

#### forge-guard
```bash
# No startup required - safety wrapper
# Provides safe mode enforcement and schema validation
```

#### forge-cairns
```bash
# No startup required - WAL library
# Provides atomic writes and idempotency
```

#### forge-pulse
```bash
# No startup required - pub/sub library
# Provides in-memory message channels
```

#### forge-health (Port 9001)
```bash
node forge-health/index.cjs
# Starts on port 9001
# Registers circuit breakers and heartbeat endpoints
```

#### forge-dashboard (Port 9000)
```bash
node forge-dashboard/index.cjs
# Starts on port 9000
# Provides web UI for metrics and logs
```

#### forge-tendrils (Port 9002)
```bash
node forge-tendrils/index.cjs
# Starts on port 9002
# Receives GitHub webhooks with HMAC verification
# Triggers git pull on push events
```

#### forge-view (Ladle)
```bash
npm run ladle
# Starts Ladle dev server (auto-assigns port)
# Live reload preview environment
```

### 3. Environment Variables

Create `.env` file:

```env
# Required
PORT=9000                    # Dashboard port
HEALTH_PORT=9001             # Health check port
WEBHOOK_PORT=9002            # Webhook receiver port
WEBHOOK_SECRET=your-secret   # GitHub webhook secret (32+ chars)

# Optional
NODE_ENV=production          # production | development
LOG_LEVEL=info               # debug | info | warn | error
SAFE_MODE=true               # Enable forge-guard protections
WAL_PATH=./data/wal          # forge-cairns WAL storage
CIRCUIT_BREAKER_THRESHOLD=5  # forge-health breaker threshold
```

### 4. Starting Services

#### Development Mode
```bash
# Terminal 1: Health monitoring
node forge-health/index.cjs

# Terminal 2: Dashboard
node forge-dashboard/index.cjs

# Terminal 3: Webhook receiver
node forge-tendrils/index.cjs

# Terminal 4: Live preview
npm run ladle
```

#### Production Mode (PM2)
```bash
# Create PM2 ecosystem file
cat &gt; ecosystem.config.cjs &lt;&lt;EOF
module.exports = {
  apps: [
    {
      name: 'forge-health',
      script: './forge-health/index.cjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M'
    },
    {
      name: 'forge-dashboard',
      script: './forge-dashboard/index.cjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M'
    },
    {
      name: 'forge-webhook',
      script: './forge-tendrils/index.cjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M'
    }
  ]
};
EOF

# Start all services
pm2 start ecosystem.config.cjs

# Save PM2 config
pm2 save

# Enable startup script
pm2 startup
```

## Verification Steps

### 1. Check Port Availability
```bash
# Ensure ports are free before starting
netstat -an | grep -E "9000|9001|9002"
```

### 2. Health Check
```bash
curl http://localhost:9001/health
# Expected: {"status":"ok","uptime":123,"modules":["health","dashboard"]}
```

### 3. Dashboard Access
```bash
curl http://localhost:9000/
# Expected: HTML dashboard page
```

### 4. Webhook Receiver
```bash
curl -X POST http://localhost:9002/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=test" \
  -d '{"ref":"refs/heads/main"}'
# Expected: 400 (invalid signature) or 200 (if signature valid)
```

### 5. Circuit Breaker Registry
```bash
curl http://localhost:9001/breakers
# Expected: {"breakers": [...]}
```

### 6. Log Verification
```bash
# Check logs for startup messages
tail -f forge-dashboard/logs/combined.log
tail -f forge-health/logs/combined.log
tail -f forge-tendrils/logs/combined.log
```

## Post-Deployment Checklist

- [ ] All services started successfully
- [ ] Health endpoint returns 200 OK
- [ ] Dashboard accessible at port 9000
- [ ] Webhook receiver listening on port 9002
- [ ] Circuit breakers registered
- [ ] Logs rotating properly
- [ ] WAL directory created (forge-cairns)
- [ ] Safe mode enabled (forge-guard)
- [ ] PM2 saved and startup configured (production)

## Rollback Procedure

### Quick Rollback
```bash
# Stop all services
pm2 stop all

# Or manual stop
pkill -f forge-health
pkill -f forge-dashboard
pkill -f forge-tendrils

# Revert to previous commit
git checkout [previous-commit-sha]

# Reinstall dependencies
npm ci

# Restart services
pm2 restart all
```

### Full Rollback
```bash
# Tag current state
git tag rollback-$(date +%Y%m%d-%H%M%S)

# Reset to stable tag
git reset --hard ff7.0-stable-20251104

# Clean install
rm -rf node_modules
npm ci

# Restart
pm2 restart all
pm2 save
```

## Production Notes

1. **Port Conflicts**: Ensure no other services using 9000-9003
2. **File Permissions**: WAL directory needs write access
3. **Webhook Secret**: Use strong 32+ character secret
4. **HMAC Verification**: Always enabled in production
5. **Log Rotation**: Configure logrotate for production logs
6. **Circuit Breakers**: Monitor threshold tuning over time
7. **Safe Mode**: Keep enabled in production for validation
8. **Memory Limits**: Tune PM2 restart thresholds based on load

## Architecture Diagram

```
GitHub Push Event
       ↓
[forge-tendrils:9002] → HMAC verify → git pull
       ↓
[forge-pulse] → Notify subscribers
       ↓
[forge-view] → Trigger reload
       ↓
[forge-build] → Compile components
       ↓
[forge-cairns] → Log to WAL
       ↓
[forge-dashboard:9000] → Update metrics
       ↓
[forge-health:9001] → Record heartbeat
```

## Support

For issues, see `docs/runbooks/TROUBLESHOOTING.md`
