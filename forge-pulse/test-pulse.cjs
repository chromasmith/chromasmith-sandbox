// forge-pulse test suite
// Run with: node test-pulse.cjs

const pulse = require('./index.cjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// Clean state before each test
function reset() {
  pulse.pulse_clear();
}

// Test 1: Subscribe and receive events
test('subscribe_and_receive_events', () => {
  reset();
  
  let received = null;
  const subId = pulse.pulse_subscribe('stage_advance', (event) => {
    received = event;
  });
  
  assert(typeof subId === 'string', 'Subscribe should return subscription ID');
  assert(subId.startsWith('pulse_sub_'), 'Subscription ID should have correct prefix');
  
  const result = pulse.pulse_publish('stage_advance', {
    sessionId: 'sess_test',
    fromStage: 'Artifacts',
    toStage: 'ForgeView',
  });
  
  assertEquals(result.published, 1, 'Should publish to 1 subscriber');
  assertEquals(result.errors, 0, 'Should have no errors');
  assert(received !== null, 'Should receive event');
  assertEquals(received.sessionId, 'sess_test', 'Should receive correct sessionId');
  assertEquals(received.fromStage, 'Artifacts', 'Should receive correct fromStage');
  assertEquals(received.toStage, 'ForgeView', 'Should receive correct toStage');
  assert(received.timestamp, 'Should inject timestamp');
});

// Test 2: Multiple subscribers on same topic
test('multiple_subscribers_same_topic', () => {
  reset();
  
  const received = [];
  
  pulse.pulse_subscribe('build_start', (event) => {
    received.push({ sub: 1, event });
  });
  
  pulse.pulse_subscribe('build_start', (event) => {
    received.push({ sub: 2, event });
  });
  
  pulse.pulse_subscribe('build_start', (event) => {
    received.push({ sub: 3, event });
  });
  
  assertEquals(pulse.pulse_get_subscriber_count('build_start'), 3, 'Should have 3 subscribers');
  
  const result = pulse.pulse_publish('build_start', {
    sessionId: 'sess_test',
    target: 'forgeview_preview',
  });
  
  assertEquals(result.published, 3, 'Should publish to 3 subscribers');
  assertEquals(result.errors, 0, 'Should have no errors');
  assertEquals(received.length, 3, 'All 3 subscribers should receive event');
});

// Test 3: Unsubscribe stops delivery
test('unsubscribe_stops_delivery', () => {
  reset();
  
  let count1 = 0;
  let count2 = 0;
  
  const sub1 = pulse.pulse_subscribe('build_finish', () => { count1++; });
  const sub2 = pulse.pulse_subscribe('build_finish', () => { count2++; });
  
  // First publish - both receive
  pulse.pulse_publish('build_finish', { sessionId: 'test', status: 'ok' });
  assertEquals(count1, 1, 'Sub1 should receive first event');
  assertEquals(count2, 1, 'Sub2 should receive first event');
  
  // Unsubscribe sub1
  const removed = pulse.pulse_unsubscribe(sub1);
  assert(removed, 'Unsubscribe should return true');
  assertEquals(pulse.pulse_get_subscriber_count('build_finish'), 1, 'Should have 1 subscriber after unsubscribe');
  
  // Second publish - only sub2 receives
  pulse.pulse_publish('build_finish', { sessionId: 'test', status: 'ok' });
  assertEquals(count1, 1, 'Sub1 should not receive after unsubscribe');
  assertEquals(count2, 2, 'Sub2 should receive second event');
});

// Test 4: Topic filtering works
test('topic_filtering_works', () => {
  reset();
  
  let stageCount = 0;
  let buildCount = 0;
  
  pulse.pulse_subscribe('stage_advance', () => { stageCount++; });
  pulse.pulse_subscribe('build_start', () => { buildCount++; });
  
  pulse.pulse_publish('stage_advance', { sessionId: 'test', fromStage: 'A', toStage: 'B' });
  assertEquals(stageCount, 1, 'Stage subscriber should receive stage event');
  assertEquals(buildCount, 0, 'Build subscriber should not receive stage event');
  
  pulse.pulse_publish('build_start', { sessionId: 'test', target: 'demo' });
  assertEquals(stageCount, 1, 'Stage subscriber should not receive build event');
  assertEquals(buildCount, 1, 'Build subscriber should receive build event');
  
  pulse.pulse_publish('build_finish', { sessionId: 'test', status: 'ok' });
  assertEquals(stageCount, 1, 'Stage subscriber should not receive unrelated event');
  assertEquals(buildCount, 1, 'Build subscriber should not receive unrelated event');
});

// Test 5: Error isolation continues delivery
test('error_isolation_continues_delivery', () => {
  reset();
  
  const received = [];
  
  // Sub 1: throws error
  pulse.pulse_subscribe('test_event', () => {
    received.push(1);
    throw new Error('Subscriber 1 error');
  });
  
  // Sub 2: succeeds
  pulse.pulse_subscribe('test_event', () => {
    received.push(2);
  });
  
  // Sub 3: throws error
  pulse.pulse_subscribe('test_event', () => {
    received.push(3);
    throw new Error('Subscriber 3 error');
  });
  
  // Sub 4: succeeds
  pulse.pulse_subscribe('test_event', () => {
    received.push(4);
  });
  
  const result = pulse.pulse_publish('test_event', { test: true });
  
  assertEquals(result.published, 2, 'Should report 2 successful deliveries');
  assertEquals(result.errors, 2, 'Should report 2 errors');
  assertEquals(received.length, 4, 'All 4 subscribers should be called');
  assert(received.includes(1), 'Sub 1 should be called before error');
  assert(received.includes(2), 'Sub 2 should succeed');
  assert(received.includes(3), 'Sub 3 should be called before error');
  assert(received.includes(4), 'Sub 4 should succeed');
});

// Test 6: Clear removes subscribers
test('clear_removes_subscribers', () => {
  reset();
  
  pulse.pulse_subscribe('topic1', () => {});
  pulse.pulse_subscribe('topic1', () => {});
  pulse.pulse_subscribe('topic2', () => {});
  pulse.pulse_subscribe('topic3', () => {});
  
  assertEquals(pulse.pulse_get_subscriber_count('topic1'), 2, 'Topic1 should have 2 subscribers');
  assertEquals(pulse.pulse_get_subscriber_count('topic2'), 1, 'Topic2 should have 1 subscriber');
  assertEquals(pulse.pulse_get_topics().length, 3, 'Should have 3 topics');
  
  // Clear specific topic
  const cleared = pulse.pulse_clear('topic1');
  assertEquals(cleared, 2, 'Should clear 2 subscribers from topic1');
  assertEquals(pulse.pulse_get_subscriber_count('topic1'), 0, 'Topic1 should have 0 subscribers');
  assertEquals(pulse.pulse_get_topics().length, 2, 'Should have 2 topics remaining');
  
  // Clear all topics
  const clearedAll = pulse.pulse_clear();
  assertEquals(clearedAll, 2, 'Should clear 2 remaining subscribers');
  assertEquals(pulse.pulse_get_topics().length, 0, 'Should have 0 topics');
});

// Run all tests
console.log('\n=== forge-pulse Test Suite ===\n');

// Additional edge case tests
test('publish_to_nonexistent_topic', () => {
  reset();
  const result = pulse.pulse_publish('nonexistent', { test: true });
  assertEquals(result.published, 0, 'Should publish to 0 subscribers');
  assertEquals(result.errors, 0, 'Should have 0 errors');
});

test('unsubscribe_invalid_id', () => {
  reset();
  const result = pulse.pulse_unsubscribe('invalid_id');
  assertEquals(result, false, 'Should return false for invalid ID');
});

test('get_subscriber_count_nonexistent', () => {
  reset();
  const count = pulse.pulse_get_subscriber_count('nonexistent');
  assertEquals(count, 0, 'Should return 0 for nonexistent topic');
});

test('timestamp_injection', () => {
  reset();
  let received = null;
  pulse.pulse_subscribe('test', (event) => { received = event; });
  
  // Without timestamp
  pulse.pulse_publish('test', { data: 'test' });
  assert(received.timestamp, 'Should inject timestamp when not provided');
  
  // With timestamp
  const customTimestamp = '2025-01-01T00:00:00.000Z';
  pulse.pulse_publish('test', { data: 'test', timestamp: customTimestamp });
  assertEquals(received.timestamp, customTimestamp, 'Should preserve provided timestamp');
});

// Summary
console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);
