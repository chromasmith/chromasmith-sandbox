# Forge Dashboard

Read-only monitoring dashboard for Forge Flow 7.0 infrastructure.

## Overview

Port: **9003**  
Server: Express.js  
Purpose: Real-time monitoring of Forge Flow modules

## Views

### Health View
- Module health status
- Circuit breaker states
- Error counts and safe mode indicators
- Last check/success timestamps

### Audit View
- Operation audit trail
- Event history with timestamps
- Operation success/failure tracking

### DLQ (Dead Letter Queue) View
- Failed operation statistics
- DLQ entries by module
- Error pattern analysis

### Events Timeline
- Real-time event stream (last 100 events)
- Module filtering
- Auto-refresh capability (5s intervals)
- Event type categorization

## Quick Start

### Start Server
```bash
node forge-dashboard/index.cjs
```

Server will start on http://localhost:9003

### Run Tests
```bash
node forge-dashboard/test-dashboard.cjs
```

Tests validate:
- Server availability on port 9003
- `/api/health` endpoint (modules array + summary)
- `/api/audit` endpoint (array response)
- `/api/dlq` endpoint (stats object)
- `/api/events` endpoint (array response)

## API Endpoints

### GET /api/health
Returns module health status and summary statistics.

**Response:**
```json
{
  "summary": {
    "healthy": 5,
    "degraded": 1,
    "down": 0,
    "total": 6
  },
  "modules": [
    {
      "name": "module-name",
      "status": "healthy",
      "circuitBreaker": "CLOSED",
      "safeMode": false,
      "errorCount": 0,
      "lastCheck": "2025-11-04T10:30:00Z",
      "lastSuccess": "2025-11-04T10:30:00Z",
      "message": "OK"
    }
  ]
}
```

### GET /api/audit
Returns operation audit trail.

**Response:** Array of audit entries
```json
[
  {
    "timestamp": "2025-11-04T10:30:00Z",
    "module": "module-name",
    "operation": "operation-name",
    "success": true,
    "details": "Operation details"
  }
]
```

### GET /api/dlq
Returns dead letter queue statistics.

**Response:**
```json
{
  "total": 5,
  "byModule": {
    "module-a": 3,
    "module-b": 2
  },
  "entries": [
    {
      "module": "module-name",
      "error": "Error message",
      "timestamp": "2025-11-04T10:30:00Z"
    }
  ]
}
```

### GET /api/events
Returns recent events timeline (last 100 events, newest first).

**Response:** Array of events
```json
[
  {
    "timestamp": "2025-11-04T10:30:00Z",
    "module": "module-name",
    "event_type": "SUCCESS",
    "details": "Event details"
  }
]
```

## Architecture

### Directory Structure
```
forge-dashboard/
├── index.cjs              # Express server
├── test-dashboard.cjs     # Test suite
├── routes/
│   ├── health.cjs        # Health endpoint
│   ├── audit.cjs         # Audit endpoint
│   ├── dlq.cjs           # DLQ endpoint
│   └── events.cjs        # Events endpoint
├── public/
│   ├── index.html        # Main dashboard UI
│   ├── css/
│   │   └── styles.css    # Dashboard styles
│   └── js/
│       ├── app.js        # Main application logic
│       ├── utils.js      # Shared utilities
│       ├── health-view.js
│       ├── audit-view.js
│       ├── dlq-view.js
│       └── events-view.js
├── README.md
└── spec/
    └── v1.md             # Specification document
```

### Features
- **Real-time monitoring**: View current system health
- **Historical analysis**: Audit trail and event timeline
- **Error tracking**: DLQ monitoring for failed operations
- **Responsive UI**: Clean, modern interface
- **Read-only**: Safe monitoring without modification capabilities

## Development

### Adding New Views
1. Create route handler in `routes/`
2. Create view controller in `public/js/`
3. Add navigation in `public/index.html`
4. Update `app.js` view routing

### Testing
Run the test suite to validate all endpoints:
```bash
node forge-dashboard/test-dashboard.cjs
```

Exit codes:
- `0`: All tests passed
- `1`: One or more tests failed

## Notes

- Dashboard is read-only by design
- No authentication required (localhost only)
- Events are limited to last 100 entries
- Auto-refresh can be toggled per view
- Module data sourced from Forge Flow core

## Version

Forge Flow 7.0 - MVP Release
