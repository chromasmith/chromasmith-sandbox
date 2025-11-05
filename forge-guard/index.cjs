const schemas = require('./schemas.cjs');

let SAFE_MODE = "off"; // "off" | "read_only"
const TOKENS = new Map(); // token -> { action, expiresAt }

function newToken() {
  return "tok_" + Math.random().toString(36).slice(2, 10);
}

function guard_confirm_request({ action, summary }) {
  const token = newToken();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  TOKENS.set(token, { action, expiresAt: expires });
  return { confirm_token: token, expires_at: expires };
}

function guard_safe_mode_get() {
  return { mode: SAFE_MODE };
}

function guard_safe_mode_set({ mode }) {
  SAFE_MODE = mode === "read_only" ? "read_only" : "off";
  return { status: "ok" };
}

function guard_enforce({ action, payload = {}, risk = "none", confirm_token }) {
  const infraActions = new Set(["build.prepare_forgeview","build.deploy_preview","build.deploy_production"]);

  if (SAFE_MODE === "read_only" && infraActions.has(action)) {
    return { allowed: false, reason: "SAFE_MODE" };
  }

  // Schema validation
  if (infraActions.has(action)) {
    const schemaName = action.replace(/\./g, '_');
    const validationResult = schemas.validate(schemaName, payload);
    if (!validationResult.valid) {
      // Log incident
      console.error(`Schema validation failed for ${action}:`, validationResult.errors);
      return {
        allowed: false,
        reason: 'SCHEMA_INVALID',
        errors: validationResult.errors
      };
    }
  }

  if (infraActions.has(action)) {
    if (!confirm_token) return { allowed: false, reason: "CONFIRM_TOKEN_REQUIRED" };
    const rec = TOKENS.get(confirm_token);
    if (!rec || rec.action !== action) return { allowed: false, reason: "TOKEN_INVALID" };
    if (new Date(rec.expiresAt).getTime() < Date.now()) return { allowed: false, reason: "TOKEN_EXPIRED" };
  }

  return { allowed: true, ticket: `ok:${action}` };
}

module.exports = {
  guard_enforce,
  guard_confirm_request,
  guard_safe_mode_get,
  guard_safe_mode_set,
};
