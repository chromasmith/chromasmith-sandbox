/**
 * Forge Flow 6.4 - Deploy Feature Playbook
 * Deploys feature with change tracking and context awareness
 * Uses: run, repo, context
 * Duration estimate: ~300ms
 */

const run = require('./run.cjs');
const repo = require('./repo.cjs');
const context = require('./context.cjs');

/**
 * Deploy a feature to the system
 * @param {string} featureId - Feature map ID
 * @param {string} targetEnv - Target environment (dev/staging/prod)
 */
async function deployFeatureWorkflow(featureId, targetEnv = 'dev') {
  console.log(`🚀 Starting feature deployment workflow...`);
  console.log(`   Feature: ${featureId}`);
  console.log(`   Target: ${targetEnv}\n`);
  
  let runId;
  
  try {
    // Step 1: Start run workflow
    runId = await run.start({
      task: 'deploy_feature',
      feature_id: featureId,
      target_env: targetEnv,
      timestamp: new Date().toISOString()
    });
    console.log(`✅ Run started: ${runId}`);
    
    // Step 2: Read feature map
    await run.note(runId, { phase: 'reading_feature' });
    let feature;
    try {
      feature = await repo.read(featureId);
      console.log(`✅ Feature loaded: ${feature.title || featureId}`);
    } catch (error) {
      if (error.message.includes('not found')) {
        console.log(`ℹ️  Feature not found, creating new deployment record`);
        feature = {
          id: featureId,
          title: `Feature ${featureId}`,
          status: 'new',
          tags: ['feature']
        };
      } else {
        throw error;
      }
    }
    
    // Step 3: Get related context
    await run.note(runId, { phase: 'gathering_context' });
    const relatedMaps = await context.getTopMaps(
      { tags: feature.tags || ['feature'] },
      3
    );
    console.log(`✅ Found ${relatedMaps.length} related maps`);
    
    // Step 4: Update feature status
    await run.note(runId, { phase: 'updating_status' });
    const updatedFeature = {
      ...feature,
      status: 'deployed',
      deployed_to: targetEnv,
      deployed_at: new Date().toISOString(),
      deployed_by: runId,
      related_maps: relatedMaps.map(m => m.id)
    };
    
    await repo.write(featureId, updatedFeature, runId);
    console.log(`✅ Feature status updated: deployed to ${targetEnv}`);
    
    // Step 5: Create deployment record
    await run.note(runId, { 
      phase: 'deployment_complete',
      feature_id: featureId,
      target_env: targetEnv,
      related_maps_count: relatedMaps.length
    });
    
    await run.finish(runId, 'succeeded');
    
    console.log('\n✅ Feature deployment completed successfully');
    return {
      status: 'deployed',
      runId,
      feature: updatedFeature,
      relatedMapsCount: relatedMaps.length
    };
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    
    if (runId) {
      await run.finish(runId, 'failed').catch(() => {});
    }
    
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  const startTime = Date.now();
  
  // Get feature ID from command line args or use default
  const featureId = process.argv[2] || 'feature-dashboard-updates';
  const targetEnv = process.argv[3] || 'dev';
  
  deployFeatureWorkflow(featureId, targetEnv)
    .then(result => {
      const elapsed = Date.now() - startTime;
      console.log(`\n⏱️  Duration: ${elapsed}ms`);
      console.log(`📊 Result:`, JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Workflow failed:', error);
      process.exit(1);
    });
}

module.exports = { deployFeatureWorkflow };
