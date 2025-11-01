const playbook = require('./playbook-maintenance-incident.cjs');

async function testIncidentPlaybook() {
  console.log('🧪 Testing Maintenance Incident Playbook...\n');
  
  try {
    // Execute the full playbook
    const result = await playbook.execute({
      severity: 'high',
      summary: 'API Gateway timeout spike detected',
      tags: ['backend', 'api', 'performance'],
      rca: 'Database connection pool exhausted under load'
    });
    
    console.log('📊 Playbook Results:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Run ID: ${result.run_id}`);
    console.log(`   Incident ID: ${result.incident_id}`);
    console.log(`   Duration: ${result.duration_ms}ms`);
    console.log(`   Related Maps: ${result.related_maps}`);
    console.log();
    
    console.log('🎉 Incident playbook test passed!');
    
  } catch (err) {
    console.error('❌ Playbook test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

testIncidentPlaybook();
