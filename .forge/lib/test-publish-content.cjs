/**
 * Test suite for publish_content playbook
 */

const { publishContentWorkflow } = require('./playbook-publish-content.cjs');

async function testPublishContent() {
  console.log('🧪 Testing publish_content playbook...\n');
  
  try {
    // Test: Publish content to multiple channels
    const result = await publishContentWorkflow('content-announcement-001', {
      channels: ['web', 'email', 'social'],
      schedule: new Date(Date.now() + 86400000).toISOString() // 24 hours from now
    });
    
    console.log('\n✅ Publish content test passed!');
    console.log(`   Content published: ${result.content.id}`);
    console.log(`   Status: ${result.content.status}`);
    console.log(`   Channels: ${result.channels.join(', ')}`);
    console.log(`   Related content: ${result.relatedContentCount}`);
    console.log(`   Version: ${result.content.version}`);
    
    return { passed: true, result };
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  const startTime = Date.now();
  testPublishContent()
    .then(result => {
      const elapsed = Date.now() - startTime;
      console.log(`\n⏱️  Duration: ${elapsed}ms`);
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { testPublishContent };