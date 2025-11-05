const CHANNELS = new Map([
  ["1", { port: 5173, branch_pattern: "dev|main|master" }],
  ["2", { port: 5174, branch_pattern: "feature/*" }],
]);

function view_channel_register({ id, port, branch_pattern }) {
  CHANNELS.set(String(id), { port, branch_pattern });
  return { status: "ok" };
}

function view_preview_url(channel = 1) {
  const ch = CHANNELS.get(String(channel)) || { port: 5173 };
  return `http://localhost:${ch.port}/`;
}

function view_webhook_receive({ provider, payload, headers }) {
  return { status: "ok" };
}

module.exports = {
  view_channel_register,
  view_preview_url,
  view_webhook_receive,
};

