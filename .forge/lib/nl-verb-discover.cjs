// NL Verb Discovery System
// Analyzes natural language requests and maps to verb sequences

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');

async function loadVerbsRegistry() {
  const verbsPath = path.join(__dirname, '../verbs.yml');
  const content = await fs.readFile(verbsPath, 'utf8');
  return yaml.parse(content);
}

function analyzeIntent(request) {
  const lower = request.toLowerCase();
  const keywords = {
    incident: ['incident', 'problem', 'issue', 'error', 'failure', 'broken'],
    validate: ['validate', 'check', 'verify', 'test', 'health'],
    deploy: ['deploy', 'ship', 'release', 'publish', 'launch'],
    content: ['content', 'article', 'post', 'schedule', 'queue'],
    create: ['create', 'new', 'add', 'make'],
    update: ['update', 'modify', 'change', 'edit'],
    read: ['read', 'get', 'fetch', 'show', 'view'],
    lock: ['lock', 'unlock', 'acquire', 'release']
  };
  
  const matches = {};
  for (const [intent, words] of Object.entries(keywords)) {
    matches[intent] = words.some(w => lower.includes(w));
  }
  return matches;
}

function mapToVerbs(intent, verbs) {
  const sequences = {
    incident: ['run.start', 'incident.start', 'incident.note', 'incident.resolve', 'run.finish'],
    validate: ['run.start', 'validate.schema', 'context.score', 'run.finish'],
    deploy: ['run.start', 'repo.write', 'context.upsert', 'run.finish'],
    content: ['run.start', 'repo.read', 'repo.write', 'context.score', 'run.finish'],
    create: ['validate.schema', 'repo.write', 'durability.audit'],
    update: ['repo.read', 'validate.schema', 'repo.write', 'durability.audit'],
    read: ['repo.read', 'context.score']
  };
  
  const matched = Object.entries(intent)
    .filter(([_, matches]) => matches)
    .map(([key]) => key);
  
  if (matched.length === 0) return { verbs: [], confidence: 0 };
  
  const primaryIntent = matched[0];
  const verbSequence = sequences[primaryIntent] || [];
  
  return {
    intent: primaryIntent,
    verbs: verbSequence,
    confidence: matched.length > 1 ? 0.8 : 0.95,
    alternateIntents: matched.slice(1)
  };
}

async function discover(request) {
  const verbs = await loadVerbsRegistry();
  const intent = analyzeIntent(request);
  const recommendation = mapToVerbs(intent, verbs);
  
  return {
    request,
    analysis: {
      ...recommendation,
      timestamp: new Date().toISOString()
    }
  };
}

module.exports = { discover };