const log = require("./logger.cjs");
const metrics = require("./metrics.cjs");
const speak = require("../forge-speak/index.cjs");
const guard = require("../forge-guard/index.cjs");
const build = require("../forge-build/index.cjs");
const view  = require("../forge-view/index.cjs");
const cairns = require("../forge-cairns/index.cjs");
const pulse = require("../forge-pulse/index.cjs");

const sessions = new Map(); // sessionId -> { stage, runState, projectName }
const rnd = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

function core_activate(project_name) {
  const session_id = `sess_${rnd()}`;
  sessions.set(session_id, { stage: "Artifacts", runState: "pending", projectName: project_name || null });
  log.info("core.activate", { session_id, project_name });
  return { status: "ok", session_id };
}

function core_get_state(session_id) {
  const s = sessions.get(session_id);
  if (!s) return { stage: "Artifacts", run_state: "pending" };
  return { stage: s.stage, run_state: s.runState };
}

function advance_stage(session_id, nextStage) {
  const s = sessions.get(session_id);
  if (!s) return;
  const fromStage = s.stage;
  s.stage = nextStage;
  cairns.events_append({ event: "stage_advance", nextStage, ts: now() }, `stage:${session_id}:${nextStage}`);
  
  // Publish stage advance event to pulse bus
  pulse.pulse_publish('stage_advance', {
    sessionId: session_id,
    fromStage: fromStage,
    toStage: nextStage,
    timestamp: now()
  });
}

function core_deactivate(session_id) {
  const s = sessions.get(session_id);
  if (s) {
    cairns.events_append({ event: "session_close", session_id, ts: now() }, `close:${session_id}`);
    sessions.delete(session_id);
  }
  log.info("core.deactivate", { session_id });
  return { status: "ok" };
}

async function core_dispatch({ intent, session_id, origin = "speak" }) {
  const t0 = Date.now();
  const s = sessions.get(session_id);
  if (!s) return { status: "error", routed_to: "none", result: { error: "NO_SESSION" } };

  const { intent_id, slots = {}, requires_confirmation, risk } = intent || {};
  log.info("core.dispatch", { session_id, intent_id, risk, requires_confirmation });

  try {
    if (!intent_id || intent_id === "unknown") {
      return { status: "error", routed_to: "none", result: { error: "INTENT_UNKNOWN" } };
    }

    if (intent_id === "artifacts_preview") {
      const url = view.view_preview_url(slots.channel || 1);
      cairns.events_append({ event: "artifacts_preview", url, ts: now() }, `art:${session_id}`);
      metrics.incr("core.intent.artifacts_preview");
      return { status: "ok", routed_to: "forge-view", result: { url } };
    }

    if (intent_id === "forgeview_preview") {
      const pre = guard.guard_enforce({
        action: "build.prepare_forgeview",
        payload: { repo_name: slots.project_name || "temp-demo", temp_allowed: true, channel: "1" },
        risk: "infra",
      });
      if (!pre.allowed) return { status: "error", routed_to: "forge-guard", result: pre };

      // Publish build start event
      pulse.pulse_publish('build_start', {
        sessionId: session_id,
        target: 'forgeview_preview',
        timestamp: now()
      });

      const r = await build.build_prepare_forgeview({ repo_name: slots.project_name || "temp-demo", temp_allowed: true, channel: "1" });
      
      // Publish build finish event
      pulse.pulse_publish('build_finish', {
        sessionId: session_id,
        target: 'forgeview_preview',
        status: r.status,
        timestamp: now()
      });
      
      if (r.status === "ok") advance_stage(session_id, "ForgeView");
      metrics.incr("core.intent.forgeview_preview");
      return { status: r.status, routed_to: "forge-build", result: r };
    }

    if (intent_id === "vercel_preview") {
      const token = slots.confirm_token || guard.guard_confirm_request({ action: "build.deploy_preview", summary: "Deploy preview" }).confirm_token;
      const pre = guard.guard_enforce({ action: "build.deploy_preview", payload: { repo_name: slots.project_name || "temp-demo", confirm_token: token }, risk: "infra", confirm_token: token });
      if (!pre.allowed) return { status: "error", routed_to: "forge-guard", result: pre };

      // Publish build start event
      pulse.pulse_publish('build_start', {
        sessionId: session_id,
        target: 'vercel_preview',
        timestamp: now()
      });

      const r = await build.build_deploy_preview({ repo_name: slots.project_name || "temp-demo", confirm_token: token });
      
      // Publish build finish event
      pulse.pulse_publish('build_finish', {
        sessionId: session_id,
        target: 'vercel_preview',
        status: r.status,
        timestamp: now()
      });
      
      if (r.status === "ok") advance_stage(session_id, "Preview");
      metrics.incr("core.intent.vercel_preview");
      return { status: r.status, routed_to: "forge-build", result: r };
    }

    if (intent_id === "production_launch") {
      const token = slots.confirm_token || guard.guard_confirm_request({ action: "build.deploy_production", summary: "Deploy production" }).confirm_token;
      const pre = guard.guard_enforce({
        action: "build.deploy_production",
        payload: { repo_name: slots.project_name || "temp-demo", domain: slots.domain || "example.com", confirm_token: token },
        risk: "infra",
        confirm_token: token,
      });
      if (!pre.allowed) return { status: "error", routed_to: "forge-guard", result: pre };

      // Publish build start event
      pulse.pulse_publish('build_start', {
        sessionId: session_id,
        target: 'production_launch',
        timestamp: now()
      });

      const r = await build.build_deploy_production({ repo_name: slots.project_name || "temp-demo", domain: slots.domain || "example.com", confirm_token: token });
      
      // Publish build finish event
      pulse.pulse_publish('build_finish', {
        sessionId: session_id,
        target: 'production_launch',
        status: r.status,
        timestamp: now()
      });
      
      if (r.status === "ok") advance_stage(session_id, "Production");
      metrics.incr("core.intent.production_launch");
      return { status: r.status, routed_to: "forge-build", result: r };
    }

    return { status: "error", routed_to: "none", result: { error: "INTENT_NOT_IMPLEMENTED" } };
  } finally {
    metrics.timing("core.dispatch.latency_ms", Date.now() - t0);
  }
}

module.exports = {
  core_activate,
  core_dispatch,
  core_get_state,
  core_deactivate,
};
