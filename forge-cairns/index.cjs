const store = new Map();       // path -> payload
const events = new Map();      // idempotency_key -> event
let walOffset = 0;

function crc32_stub(s) {
  let c = 0;
  for (let i = 0; i < s.length; i++) c = (c + s.charCodeAt(i)) >>> 0;
  return c.toString(16);
}

function wal_append({ record }) {
  const payload = JSON.stringify(record || {});
  const crc32 = crc32_stub(payload);
  const offset = ++walOffset;
  return { crc32, offset };
}

function atomic_write_json({ path, payload }) {
  const data = JSON.stringify(payload || {});
  store.set(path, data);
  const checksum = crc32_stub(data);
  return { status: "ok", checksum };
}

function events_append(event, idempotency_key) {
  if (events.has(idempotency_key)) return { status: "dup", ledger_offset: 0 };
  events.set(idempotency_key, { event, ts: Date.now() });
  return { status: "ok", ledger_offset: events.size };
}

function context_load({ project }) {
  const trio_tokens = 900;
  const maps_loaded = ["project_fingerprint.json","map_index_with_triggers.json","active_intent.json"];
  return { trio_tokens, maps_loaded, policy_applied: "none" };
}

module.exports = {
  wal_append,
  atomic_write_json,
  events_append,
  context_load,
};

