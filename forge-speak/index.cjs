const normalize = s => String(s || "").trim().toLowerCase();

const GRAMMAR = {
  artifacts_preview: ["mockup", "render artifact", "quick mockup", "show a quick mockup", "mock this up"],
  forgeview_preview: ["forge view", "working version", "clickable preview", "see this in forge view"],
  vercel_preview:   ["deploy a preview", "shareable preview", "live webpage", "preview url"],
  production_launch:["go live", "ship this", "launch to production", "production"],
};

function speak_parse({ utterance, context_hint }) {
  const u = normalize(utterance);
  let intent_id = "unknown";
  let requires_confirmation = false;
  let risk = "none";
  let confidence = 0.0;

  for (const [id, phrases] of Object.entries(GRAMMAR)) {
    if (phrases.some(p => u.includes(p))) {
      intent_id = id;
      confidence = 0.9;
      if (id !== "artifacts_preview") { requires_confirmation = true; risk = "infra"; }
      break;
    }
  }

  const projectMatch = u.match(/(?:called|named)\s+([a-z0-9-]+)/);
  const domainMatch  = u.match(/\b([a-z0-9.-]+\.[a-z]{2,})\b/);
  const slots = {};
  if (projectMatch) slots.project_name = projectMatch[1];
  if (domainMatch) slots.domain = domainMatch[1];

  return {
    intent_id,
    slots,
    confidence,
    requires_confirmation,
    risk,
    normalized_command: u,
  };
}

function speak_grammar_add({ intent_id, utterances }) {
  if (!GRAMMAR[intent_id]) GRAMMAR[intent_id] = [];
  GRAMMAR[intent_id].push(...utterances.map(normalize));
  return { status: "ok" };
}

module.exports = { speak_parse, speak_grammar_add };

