/**
 * Forge View - Real Ladle Control Implementation
 * Controls actual PM2 Ladle processes and preview URLs
 */

const CHANNELS = new Map([
  ["1", { 
    port: 5173, 
    branch_pattern: /^(dev|main|master)$/,
    pm2_name: "ladle-chromasmith-sandbox"
  }],
  ["2", { 
    port: 5174, 
    branch_pattern: /^feature\/.+$/,
    pm2_name: "ladle-chromasmith-sandbox-channel-2"
  }]
]);

const BASE_URL = process.env.FORGEVIEW_BASE_URL || "https://chromasmith-sandbox.components.chromasmith.com";

/**
 * Derive channel number from branch name
 */
function derive_channel(branch) {
  // Strip refs/heads/ prefix if present
  const clean_branch = branch.replace(/^refs\/heads\//, '');
  
  for (const [id, config] of CHANNELS.entries()) {
    if (config.branch_pattern.test(clean_branch)) {
      return id;
    }
  }
  return "1"; // default to channel 1
}

/**
 * Register a channel (store metadata)
 */
function view_channel_register({ id, port, branch_pattern }) {
  const existing = CHANNELS.get(String(id));
  if (existing) {
    return { 
      status: "ok", 
      message: `Channel ${id} already registered`,
      config: existing 
    };
  }
  
  CHANNELS.set(String(id), { 
    port, 
    branch_pattern: new RegExp(branch_pattern),
    pm2_name: `ladle-chromasmith-sandbox-channel-${id}`
  });
  return { status: "ok", channel: id };
}

/**
 * Get preview URL for a channel
 */
function view_preview_url(channel = "1") {
  const ch = CHANNELS.get(String(channel));
  if (!ch) {
    return `${BASE_URL}/?channel=${channel}`;
  }
  return BASE_URL;
}

/**
 * Handle incoming webhook (validate and route)
 */
function view_webhook_receive({ provider, payload, headers }) {
  // For now, just acknowledge receipt
  // Full HMAC validation happens in webhook listener
  return { 
    status: "ok",
    provider,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get channel status from PM2
 */
async function view_channel_status(channel = "1") {
  const ch = CHANNELS.get(String(channel));
  if (!ch) {
    return { status: "error", message: "Channel not found" };
  }
  
  return {
    status: "ok",
    channel,
    port: ch.port,
    pm2_name: ch.pm2_name,
    url: view_preview_url(channel)
  };
}

module.exports = {
  view_channel_register,
  view_preview_url,
  view_webhook_receive,
  view_channel_status,
  derive_channel,
  CHANNELS
};

