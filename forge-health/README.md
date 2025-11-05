# forge-health

Health monitoring and circuit breaker system for Forge Flow 7.0 MVP.

## Overview

forge-health provides service health monitoring with circuit breaker pattern implementation and automatic safe-mode integration with forge-guard. When services fail repeatedly, circuit breakers open and safe mode activates to protect infrastructure from cascading failures.

## Features

- **Circuit Breaker Registry**: Track service health with CLOSED/OPEN/HALF_OPEN states
- **Automatic Safe Mode**: Integrates with forge-guard to block writes when breakers open
- **Health Aggregation**: Monitor overall system health across all services
- **HTTP Server**: Simple health check endpoint on port 9002
- **Zero Dependencies**: Uses only Node.js built-in modules

## Health Server

The health server provides real-time monitoring via HTTP endpoints:

```bash
# Start the server
node forge-health/health-server.cjs

# Or with custom port
HEALTH_PORT=9003 node forge-health/health-server.cjs
```

### Endpoints

- **GET /** - HTML info page with live status
- **GET /health** - Basic JSON health status
- **GET /health/detailed** - Detailed JSON with breaker states, memory, uptime

Default server: `http://localhost:9002`

### Example Response

```json
{
  "status": "healthy",
  "services": [
    {
      "name": "build-service",
      "state": "CLOSED",
      "failureCount": 0
    }
  ],
  "safeMode": "off",
  "timestamp": "2025-11-05T04:15:00.000Z"
}
```

## Circuit Breaker States

### CLOSED
- **Normal operation**: All requests flow through
- **Condition**: Service is healthy
- **Transitions**: To OPEN after 3 consecutive failures

### OPEN
- **Failure state**: Service has failed threshold (3 failures)
- **Behavior**: Blocks requests, safe mode activates
- **Duration**: 60 seconds before transitioning to HALF_OPEN
- **Purpose**: Prevent cascading failures, give service time to recover

### HALF_OPEN
- **Testing state**: Allows limited traffic to test recovery
- **Transitions**:
  - To CLOSED on success (service recovered)
  - To OPEN on failure (service still unhealthy)

## Thresholds

- **Failure Threshold**: 3 consecutive failures
- **Timeout Duration**: 60 seconds (before HALF_OPEN)
- **Safe Mode**: Auto-enables when any breaker opens

## Safe Mode Integration

forge-health integrates with forge-guard to honor safe mode when breakers are OPEN:

```javascript
const health = require('./forge-health');

// Check if writes should be blocked
if (health.health_should_block_writes()) {
  // Block write operations
  return { allowed: false, reason: 'SAFE_MODE_BREAKER_OPEN' };
}
```

Safe mode automatically:
- **Enables** when any breaker opens (3+ failures)
- **Disables** when all breakers close (services recover)

## API Reference

### health_check(serviceName)
Check health of a specific service.

```javascript
const health = require('./forge-health');
const status = health.health_check('my-service');
// Returns: { serviceName, healthy, state, failureCount, lastFailure, advice }
```

### health_get_status()
Get aggregate health status of all services.

```javascript
const status = health.health_get_status();
// Returns: { status, services, safeMode, timestamp }
// status: 'healthy' | 'degraded' | 'unhealthy'
```

### health_get_safe_mode()
Get current safe mode status.

```javascript
const safeMode = health.health_get_safe_mode();
// Returns: { mode, active, reason }
// mode: 'off' | 'read_only'
```

### health_set_safe_mode({ mode })
Set safe mode manually.

```javascript
health.health_set_safe_mode({ mode: 'read_only' });
// Returns: { status, mode }
```

### health_should_block_writes()
Check if writes should be blocked (safe mode active OR breakers open).

```javascript
if (health.health_should_block_writes()) {
  // Block write operations
}
// Returns: boolean
```

### health_register_service(serviceName)
Register a service for monitoring.

```javascript
health.health_register_service('my-service');
// Returns: { status, serviceName }
```

### health_record_failure(serviceName)
Record a service failure (increments failure count, may open breaker).

```javascript
health.health_record_failure('my-service');
// Returns: { serviceName, state, failureCount }
```

### health_record_success(serviceName)
Record a service success (resets failure count, may close breaker).

```javascript
health.health_record_success('my-service');
// Returns: { serviceName, state, failureCount }
```

### health_reset_breaker(serviceName)
Manually reset a breaker to CLOSED state.

```javascript
health.health_reset_breaker('my-service');
// Returns: { status, serviceName }
```

## Usage Example

```javascript
const health = require('./forge-health');

// Register service
health.health_register_service('build-service');

// Simulate failures
try {
  await buildProcess();
  health.health_record_success('build-service');
} catch (err) {
  health.health_record_failure('build-service');
  // After 3 failures, breaker opens and safe mode activates
}

// Check before write operations
if (!health.health_should_block_writes()) {
  await performWrite();
} else {
  console.log('Writes blocked - safe mode active');
}

// Get overall status
const status = health.health_get_status();
console.log(`System status: ${status.status}`);
```

## Testing

Run the test suite to verify functionality:

```bash
node forge-health/test-health.cjs
```

Tests cover:
1. Breaker registration and state tracking
2. Breaker opens after 3 failures
3. Breaker half-opens after timeout
4. Health aggregates service status
5. Guard respects safe mode from health

## Integration with forge-guard

forge-guard checks forge-health before allowing write operations:

```javascript
// In forge-guard/index.cjs
const health = require('../forge-health');

function guard_enforce({ action, ... }) {
  if (health.health_should_block_writes()) {
    return { allowed: false, reason: 'SAFE_MODE_BREAKER_OPEN' };
  }
  // ... rest of guard logic
}
```

This ensures infrastructure writes are blocked when services are unhealthy.

## Architecture

```
forge-health/
├── index.cjs              # Main module with health functions
├── breaker-registry.cjs   # Circuit breaker state machine
├── health-server.cjs      # HTTP server (port 9002)
├── test-health.cjs        # Test suite
└── README.md              # This file

Dependencies:
└── forge-guard/index.cjs  # Enforces safe mode for writes
```

## Troubleshooting

### Service stuck OPEN
- Wait 60 seconds for auto-transition to HALF_OPEN
- Manually reset: `health.health_reset_breaker('service-name')`
- Check service logs for root cause

### Safe mode won't disable
- Check: `health.health_get_status()` for OPEN breakers
- Ensure all services have recovered
- Manually disable if needed: `health.health_set_safe_mode({ mode: 'off' })`

### Health server not starting
- Check port 9002 is available
- Use custom port: `HEALTH_PORT=9003 node health-server.cjs`
- Verify no firewall blocks

## License

Part of Forge Flow 7.0 MVP - Chromasmith LLC
