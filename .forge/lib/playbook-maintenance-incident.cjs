const run = require('./run.cjs');
const incident = require('./incident.cjs');
const context = require('./context.cjs');

// Orchestrate a complete maintenance incident workflow
async function execute(incidentPayload) {
  console.log('🎬 Starting Maintenance Incident Playbook...\n');
  
  let runId, incidentId;
  
  try {
    // Step 1: Start run
    console.log('Step 1: Starting run workflow...');
    runId = await run.start({
      playbook: 'maintenance_incident',
      severity: incidentPayload.severity,
      summary: incidentPayload.summary
    });
    console.log(`✅ Run started: ${runId}\n`);
    
    // Step 2: Find related context
    console.log('Step 2: Finding related maps from context...');
    const contextHint = {
      tags: incidentPayload.tags || []
    };
    const relatedMaps = await context.getTopMaps(contextHint, 3);
    console.log(`✅ Found ${relatedMaps.length} related maps:`);
    relatedMaps.forEach(map => {
      console.log(`   - ${map.name} (score: ${map.score.total.toFixed(3)})`);
    });
    console.log();
    
    await run.note(runId, {
      step: 'context_loaded',
      related_maps: relatedMaps.map(m => m.id)
    });
    
    // Step 3: Start incident
    console.log('Step 3: Creating incident...');
    incidentId = await incident.start({
      ...incidentPayload,
      related_maps: relatedMaps.map(m => m.id)
    });
    console.log(`✅ Incident created: ${incidentId}\n`);
    
    await run.note(runId, {
      step: 'incident_started',
      incident_id: incidentId
    });
    
    // Step 4: Investigation simulation
    console.log('Step 4: Investigation phase...');
    await incident.note(incidentId, {
      phase: 'investigation',
      findings: 'Checking logs and metrics'
    });
    await run.note(runId, { step: 'investigation_started' });
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await incident.note(incidentId, {
      phase: 'investigation',
      findings: 'Root cause identified'
    });
    console.log('✅ Investigation complete\n');
    
    // Step 5: Resolution
    console.log('Step 5: Resolving incident...');
    const resolvedIncident = await incident.resolve(incidentId, {
      cause: incidentPayload.rca || 'Transient network issue',
      action_taken: 'Service restarted, monitoring enhanced',
      prevention: 'Added circuit breaker and alerts'
    });
    console.log(`✅ Incident resolved in ${resolvedIncident.duration_ms}ms\n`);
    
    await run.note(runId, {
      step: 'incident_resolved',
      duration_ms: resolvedIncident.duration_ms
    });
    
    // Step 6: Finish run
    console.log('Step 6: Completing run...');
    const finalRun = await run.finish(runId, 'succeeded');
    console.log(`✅ Run completed in ${finalRun.duration_ms}ms\n`);
    
    console.log('🎉 Maintenance Incident Playbook Complete!\n');
    
    return {
      success: true,
      run_id: runId,
      incident_id: incidentId,
      duration_ms: finalRun.duration_ms,
      related_maps: relatedMaps.length
    };
    
  } catch (err) {
    console.error('❌ Playbook failed:', err.message);
    
    if (runId) {
      await run.finish(runId, 'failed').catch(() => {});
    }
    
    throw err;
  }
}

module.exports = {
  execute
};
