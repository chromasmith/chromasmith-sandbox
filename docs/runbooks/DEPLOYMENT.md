# Forge Flow 7.0 - Deployment Runbook

## Prerequisites
- Node.js v22.21.0+
- Ports available: 9000-9003
- Git access to chromasmith/chromasmith-sandbox
- ForgeView VM: Ubuntu 22.04 (or equivalent)

## Port Assignments
- 9000: Webhook listener (ForgeView)
- 9001: Forge Cairns service
- 9002: Forge Health service
- 9003: Forge Dashboard

## Module Setup Sequence

### 1. Core Foundation
- forge-core: Central orchestrator
- forge-speak: NL interpreter
- forge-cairns: Durability layer

### 2. Safety Layer
- forge-guard: Safety enforcement
- forge-health: Health monitoring

### 3. Infrastructure
- forge-build: Build pipeline
- forge-view: Preview surface
- forge-pulse: Event transport

### 4. Extensions
- forge-tokens: Design tokens
- forge-stubs: Placeholder data
- forge-tendrils: Adapter layer
- forge-playbooks: Workflow engine
- forge-dashboard: Admin interface

## Starting Services

### Webhook Listener (Port 9000)
```bash
cd ~/webhook-listener
node server.js
```

### Dashboard (Port 9003)
```bash
cd ~/chromasmith-sandbox
node forge-dashboard/index.cjs
```

### Health Server (Port 9002)
```bash
node forge-health/index.cjs
```

## Verification Steps

### Health Checks
```bash
curl http://localhost:9000/health | jq '.'
curl http://localhost:9002/health | jq '.'
curl http://localhost:9003/api/health | jq '.'
```

### Webhook Test
```bash
curl -X POST http://localhost:9000/webhook \
  -H "X-Hub-Signature-256: sha256=..." \
  -H "Content-Type: application/json" \
  -d '{"ref":"refs/heads/dev"}'
```

### Dashboard Access
```bash
curl http://localhost:9003
# Open browser: http://forgeview-ip:9003
```

## Environment Variables

### Required
- NODE_ENV=production (or development)
- FORGE_ROOT=~/.forge
- GITHUB_WEBHOOK_SECRET=(from secrets.json)

### Optional
- PORT_WEBHOOK=9000
- PORT_CAIRNS=9001
- PORT_HEALTH=9002
- PORT_DASHBOARD=9003

## PM2 Integration

### Install PM2
```bash
npm install -g pm2
```

### Start All Services
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### Monitor Services
```bash
pm2 status
pm2 logs
pm2 monit
```

## Rollback Procedure

### 1. Identify Last Stable Tag
```bash
git tag -l "ff7.*-stable-*"
```

### 2. Stop Services
```bash
pm2 stop all
```

### 3. Checkout Stable Tag
```bash
git checkout ff7.0-stable-YYYYMMDD
```

### 4. Restart Services
```bash
pm2 restart all
```

### 5. Verify
```bash
curl http://localhost:9000/health
curl http://localhost:9003/api/health
```

## Post-Deployment Checklist

- [ ] All services responding on assigned ports
- [ ] Webhook receiving GitHub push events
- [ ] Dashboard displays all 12 modules
- [ ] Health checks passing
- [ ] Logs writing to .forge/status/logs/
- [ ] WAL operational (.forge/_wal/)
- [ ] Circuit breakers in CLOSED state

## Troubleshooting Quick Reference

See TROUBLESHOOTING.md for detailed diagnostics.

Common issues:
- Port conflicts: `lsof -i :9000-9003`
- Lock stuck: `rm .forge/_wal/transaction.lock`
- Safe mode: Check `.forge/status/health.json`
