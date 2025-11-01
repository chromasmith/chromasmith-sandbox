const durability = require('./durability.cjs');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const FORGE_ROOT = path.join(__dirname, '..');

// Start a new incident
async function start(payload) {
  const incidentId = `incident-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  
  const incident = {
    id: incidentId,
    status: 'open',
    severity: payload.severity || 'medium',
    summary: payload.summary,
    started_at: new Date().toISOString(),
    notes: [],
    related_maps: payload.related_maps || [],
    rca: null,
    resolved_at: null
  };
  
  // Write incident file
  await durability.atomicWriteJson(
    `_incidents/${incidentId}.json`,
    incident,
    incidentId
  );
  
  // Audit log
  await durability.appendAuditLog({
    action: 'incident.start',
    incident_id: incidentId,
    severity: incident.severity,
    summary: incident.summary
  });
  
  // Event ledger
  await durability.appendEventLedger(
    incidentId,
    { action: 'start', severity: incident.severity },
    'incident_lifecycle'
  );
  
  console.log(`🚨 Incident started: ${incidentId} (${incident.severity})`);
  return incidentId;
}

// Add note to incident
async function note(incidentId, notePayload) {
  const incidentPath = path.join(FORGE_ROOT, `_incidents/${incidentId}.json`);
  
  const incident = JSON.parse(await fs.readFile(incidentPath, 'utf8'));
  
  const noteEntry = {
    timestamp: new Date().toISOString(),
    content: notePayload
  };
  incident.notes.push(noteEntry);
  
  await durability.atomicWriteJson(
    `_incidents/${incidentId}.json`,
    incident,
    incidentId
  );
  
  await durability.appendAuditLog({
    action: 'incident.note',
    incident_id: incidentId,
    note: notePayload
  });
  
  console.log(`📝 Note added to incident ${incidentId}`);
  return noteEntry;
}

// Resolve incident with RCA
async function resolve(incidentId, rca) {
  const incidentPath = path.join(FORGE_ROOT, `_incidents/${incidentId}.json`);
  
  const incident = JSON.parse(await fs.readFile(incidentPath, 'utf8'));
  
  incident.status = 'resolved';
  incident.rca = rca;
  incident.resolved_at = new Date().toISOString();
  incident.duration_ms = new Date(incident.resolved_at) - new Date(incident.started_at);
  
  await durability.atomicWriteJson(
    `_incidents/${incidentId}.json`,
    incident,
    incidentId
  );
  
  await durability.appendAuditLog({
    action: 'incident.resolve',
    incident_id: incidentId,
    rca: rca,
    duration_ms: incident.duration_ms
  });
  
  await durability.appendEventLedger(
    `${incidentId}-resolved`,
    { action: 'resolve', duration_ms: incident.duration_ms },
    'incident_lifecycle'
  );
  
  console.log(`✅ Incident resolved: ${incidentId}`);
  return incident;
}

module.exports = {
  start,
  note,
  resolve
};
