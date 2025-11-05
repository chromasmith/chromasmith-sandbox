# forge-pulse

In-memory event bus for Forge Flow internal messaging. Enables pub/sub pattern for stage transitions and build lifecycle events.

## Overview

`forge-pulse` provides a lightweight, synchronous event bus for broadcasting internal system events across Forge Flow modules. It uses a simple topic-based subscription model with automatic error isolation to ensure one failing subscriber doesn't impact others.

## Architecture

- **In-Memory**: All subscriptions stored in process memory (no external queues)
- **Synchronous**: Event delivery happens immediately in the same call stack
- **Error Isolation**: Subscriber errors are caught and logged but don't stop other deliveries
- **Topic-Based**: Events are organized by topic strings (e.g., "stage_advance", "build_start")

## Event Types

### stage_advance

Fired when a session transitions between stages in the Forge Flow lifecycle.

```javascript
{
  sessionId: "sess_abc123",
  fromStage: "Artifacts",
  toStage: "ForgeView",
  timestamp: "2025-11-05T04:00:00.000Z"
}
```

### build_start

Fired when a build operation begins.

```javascript
{
  sessionId: "sess_abc123",
  target: "forgeview_preview",
  timestamp: "2025-11-05T04:00:00.000Z"
}
```

### build_finish

Fired when a build operation completes.

```javascript
{
  sessionId: "sess_abc123",
  target: "forgeview_preview",
  status: "ok",
  timestamp: "2025-11-05T04:00:00.000Z"
}
```

## API Reference

### pulse_publish(topic, event)

Broadcast an event to all subscribers of a topic.

**Parameters:**
- `topic` (string): Event topic name
- `event` (object): Event payload (must be an object)

**Returns:** `{ published: number, errors: number }`

**Example:**
```javascript
const pulse = require('./forge-pulse/index.cjs');

pulse.pulse_publish('stage_advance', {
  sessionId: 'sess_123',
  fromStage: 'Artifacts',
  toStage: 'ForgeView'
});
// Returns: { published: 2, errors: 0 }
```

### pulse_subscribe(topic, handler)

Subscribe to events on a topic.

**Parameters:**
- `topic` (string): Event topic to subscribe to
- `handler` (function): Callback function `(event) => void`

**Returns:** `string` - Subscription ID for unsubscribing

**Example:**
```javascript
const subId = pulse.pulse_subscribe('build_finish', (event) => {
  console.log('Build completed:', event.target, event.status);
});
```

### pulse_unsubscribe(subscriptionId)

Remove a subscription.

**Parameters:**
- `subscriptionId` (string): ID returned from `pulse_subscribe`

**Returns:** `boolean` - `true` if subscription was found and removed

**Example:**
```javascript
pulse.pulse_unsubscribe(subId);
```

### pulse_get_topics()

Get list of all active topics.

**Returns:** `string[]` - Array of topic names

**Example:**
```javascript
const topics = pulse.pulse_get_topics();
// Returns: ['stage_advance', 'build_start', 'build_finish']
```

### pulse_get_subscriber_count(topic)

Get subscriber count for a topic.

**Parameters:**
- `topic` (string): Topic name

**Returns:** `number` - Number of subscribers (0 if topic doesn't exist)

**Example:**
```javascript
const count = pulse.pulse_get_subscriber_count('stage_advance');
// Returns: 3
```

### pulse_clear([topic])

Clear subscribers (all topics or specific topic).

**Parameters:**
- `topic` (string, optional): Topic to clear. If omitted, clears all topics.

**Returns:** `number` - Number of subscribers removed

**Example:**
```javascript
// Clear specific topic
pulse.pulse_clear('build_start');

// Clear all topics
pulse.pulse_clear();
```

## Usage Examples

### Basic Subscription

```javascript
const pulse = require('./forge-pulse/index.cjs');

// Subscribe to stage transitions
const subId = pulse.pulse_subscribe('stage_advance', (event) => {
  console.log(`Session ${event.sessionId} moved from ${event.fromStage} to ${event.toStage}`);
});

// Later: unsubscribe
pulse.pulse_unsubscribe(subId);
```

### Multiple Subscribers

```javascript
// Analytics subscriber
pulse.pulse_subscribe('build_finish', (event) => {
  if (event.status === 'ok') {
    metrics.incr('successful_builds');
  }
});

// Logging subscriber
pulse.pulse_subscribe('build_finish', (event) => {
  log.info('Build complete', { target: event.target, status: event.status });
});

// Notification subscriber
pulse.pulse_subscribe('build_finish', (event) => {
  notifyUser(event.sessionId, `Build ${event.target} ${event.status}`);
});
```

### Error Handling

Subscriber errors are automatically caught and logged. Other subscribers continue to receive events.

```javascript
pulse.pulse_subscribe('stage_advance', (event) => {
  throw new Error('This subscriber has a bug');
  // Error is caught and logged, but other subscribers still run
});

pulse.pulse_subscribe('stage_advance', (event) => {
  console.log('This subscriber still runs!');
});
```

## Integration

### forge-core Integration

`forge-core` automatically publishes pulse events for:

1. **Stage Transitions**: When `advance_stage()` is called
2. **Build Start**: Before each build operation begins
3. **Build Finish**: After each build operation completes

Example from forge-core:

```javascript
const pulse = require('../forge-pulse/index.cjs');

function advance_stage(session_id, nextStage) {
  const s = sessions.get(session_id);
  if (!s) return;
  const fromStage = s.stage;
  s.stage = nextStage;
  
  pulse.pulse_publish('stage_advance', {
    sessionId: session_id,
    fromStage: fromStage,
    toStage: nextStage,
    timestamp: now()
  });
}
```

## Testing

Run the test suite:

```bash
node forge-pulse/test-pulse.cjs
```

The test suite includes:
- Subscribe and receive events
- Multiple subscribers on same topic
- Unsubscribe stops delivery
- Topic filtering works correctly
- Error isolation continues delivery
- Clear removes subscribers

## Error Handling Guarantees

1. **Subscriber Errors**: Caught per-subscriber, logged to console, other subscribers continue
2. **Invalid Parameters**: Throw errors immediately (e.g., non-string topic, non-function handler)
3. **Missing Topics**: Publishing to a topic with no subscribers is safe (returns `{ published: 0, errors: 0 }`)

## Future Migration Path

The current in-memory implementation can be migrated to external queues when needed:

### Cloudflare Queues

```javascript
// Future: Replace in-memory storage with Cloudflare Queues
async function pulse_publish(topic, event) {
  await env.PULSE_QUEUE.send({
    topic,
    event,
    timestamp: new Date().toISOString()
  });
}
```

### Redis Pub/Sub

```javascript
// Future: Use Redis for distributed pub/sub
const redis = require('redis');
const subscriber = redis.createClient();

subscriber.on('message', (channel, message) => {
  const event = JSON.parse(message);
  // Trigger local handlers
});
```

The API surface remains the same, making migration transparent to consumers.

## Performance Characteristics

- **Memory**: O(subscribers) - Each subscription stores a function reference
- **Publish**: O(subscribers) - Synchronous loop through all subscribers for a topic
- **Subscribe/Unsubscribe**: O(1) - Map lookups and Set operations
- **Topic Lookup**: O(1) - Map-based storage

## Best Practices

1. **Unsubscribe on Cleanup**: Always unsubscribe when components unmount or close
2. **Error Handling**: Don't throw errors in subscribers unless absolutely necessary
3. **Keep Handlers Fast**: Subscribers run synchronously; avoid slow operations
4. **Topic Naming**: Use consistent naming conventions (e.g., `module_action` format)
5. **Event Payloads**: Always include `sessionId` and let pulse inject `timestamp`

## Troubleshooting

### Events Not Being Received

```javascript
// Check subscriber count
const count = pulse.pulse_get_subscriber_count('my_topic');
console.log(`Topic has ${count} subscribers`);

// List all topics
const topics = pulse.pulse_get_topics();
console.log('Active topics:', topics);
```

### Memory Leaks

```javascript
// Clear all subscriptions when testing or resetting
pulse.pulse_clear();
```

### Subscriber Errors

Check console output for error messages:
```
[forge-pulse] Subscriber error on topic "stage_advance": Error message here
```

## Module Status

- **Phase**: P7 - Safety and Signals
- **Version**: 1.0.0
- **Status**: Active
- **Dependencies**: None (standalone module)
- **Dependents**: forge-core

---

**Forge Flow 7.0 MVP** | Chromasmith LLC
