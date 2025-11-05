// forge-pulse: In-memory event bus for Forge Flow internal messaging
// Enables pub/sub pattern for stage transitions and build lifecycle events

const subscriptions = new Map(); // topic -> Set of { id, handler }
let subCounter = 0;

const rnd = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

/**
 * Publish an event to all subscribers of a topic
 * @param {string} topic - Event topic (e.g., "stage_advance", "build_start", "build_finish")
 * @param {object} event - Event payload (must be object)
 * @returns {object} { published: number, errors: number }
 */
function pulse_publish(topic, event) {
  if (!topic || typeof topic !== 'string') {
    throw new Error('pulse_publish: topic must be a non-empty string');
  }
  if (!event || typeof event !== 'object') {
    throw new Error('pulse_publish: event must be an object');
  }

  // Inject timestamp if not provided
  if (!event.timestamp) {
    event.timestamp = now();
  }

  const subs = subscriptions.get(topic);
  if (!subs || subs.size === 0) {
    return { published: 0, errors: 0 };
  }

  let published = 0;
  let errors = 0;

  // Synchronous delivery with error isolation
  for (const sub of subs) {
    try {
      sub.handler(event);
      published++;
    } catch (err) {
      errors++;
      console.error(`[forge-pulse] Subscriber error on topic "${topic}":`, err.message);
    }
  }

  return { published, errors };
}

/**
 * Subscribe to events on a topic
 * @param {string} topic - Event topic to subscribe to
 * @param {function} handler - Callback function(event) => void
 * @returns {string} Subscription ID for unsubscribing
 */
function pulse_subscribe(topic, handler) {
  if (!topic || typeof topic !== 'string') {
    throw new Error('pulse_subscribe: topic must be a non-empty string');
  }
  if (typeof handler !== 'function') {
    throw new Error('pulse_subscribe: handler must be a function');
  }

  if (!subscriptions.has(topic)) {
    subscriptions.set(topic, new Set());
  }

  const id = `pulse_sub_${++subCounter}_${rnd()}`;
  const sub = { id, handler };
  
  subscriptions.get(topic).add(sub);
  
  return id;
}

/**
 * Unsubscribe from events
 * @param {string} subscriptionId - ID returned from pulse_subscribe
 * @returns {boolean} true if subscription was found and removed
 */
function pulse_unsubscribe(subscriptionId) {
  if (!subscriptionId || typeof subscriptionId !== 'string') {
    return false;
  }

  // Search all topics for this subscription ID
  for (const [topic, subs] of subscriptions.entries()) {
    for (const sub of subs) {
      if (sub.id === subscriptionId) {
        subs.delete(sub);
        
        // Clean up empty topic sets
        if (subs.size === 0) {
          subscriptions.delete(topic);
        }
        
        return true;
      }
    }
  }

  return false;
}

/**
 * Get list of all active topics
 * @returns {string[]} Array of topic names
 */
function pulse_get_topics() {
  return Array.from(subscriptions.keys());
}

/**
 * Get subscriber count for a topic
 * @param {string} topic - Topic name
 * @returns {number} Number of subscribers (0 if topic doesn't exist)
 */
function pulse_get_subscriber_count(topic) {
  const subs = subscriptions.get(topic);
  return subs ? subs.size : 0;
}

/**
 * Clear subscribers (all topics or specific topic)
 * @param {string} [topic] - Optional topic to clear (clears all if omitted)
 * @returns {number} Number of subscribers removed
 */
function pulse_clear(topic) {
  if (topic) {
    const subs = subscriptions.get(topic);
    if (subs) {
      const count = subs.size;
      subscriptions.delete(topic);
      return count;
    }
    return 0;
  }

  // Clear all topics
  let totalCount = 0;
  for (const subs of subscriptions.values()) {
    totalCount += subs.size;
  }
  subscriptions.clear();
  return totalCount;
}

module.exports = {
  pulse_publish,
  pulse_subscribe,
  pulse_unsubscribe,
  pulse_get_topics,
  pulse_get_subscriber_count,
  pulse_clear,
};
