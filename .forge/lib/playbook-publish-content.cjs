/**
 * Forge Flow 6.4 - Publish Content Playbook
 * Content publishing with scheduling and release notes
 * Uses: run, repo, context
 * Duration estimate: ~250ms
 */

const run = require('./run.cjs');
const repo = require('./repo.cjs');
const context = require('./context.cjs');

/**
 * Publish content to the system
 * @param {string} contentId - Content map ID
 * @param {object} publishOptions - Publishing options (schedule, channels, etc)
 */
async function publishContentWorkflow(contentId, publishOptions = {}) {
  console.log(`📝 Starting content publishing workflow...`);
  console.log(`   Content: ${contentId}\n`);
  
  let runId;
  
  try {
    // Step 1: Start run workflow
    runId = await run.start({
      task: 'publish_content',
      content_id: contentId,
      publish_options: publishOptions,
      timestamp: new Date().toISOString()
    });
    console.log(`✅ Run started: ${runId}`);
    
    // Step 2: Read content map
    await run.note(runId, { phase: 'reading_content' });
    let content;
    try {
      content = await repo.read(contentId);
      console.log(`✅ Content loaded: ${content.title || contentId}`);
    } catch (error) {
      if (error.message.includes('not found')) {
        console.log(`ℹ️  Content not found, creating new content record`);
        const now = new Date().toISOString();
        content = {
          id: contentId,
          title: `Content ${contentId}`,
          status: 'draft',
          tags: ['content'],
          created_at: now,
          updated_at: now
        };
      } else {
        throw error;
      }
    }
    
    // Step 3: Get related content for context
    await run.note(runId, { phase: 'gathering_context' });
    const relatedContent = await context.getTopMaps(
      { tags: content.tags || ['content'] },
      5
    );
    console.log(`✅ Found ${relatedContent.length} related content items`);
    
    // Step 4: Prepare publishing metadata
    await run.note(runId, { phase: 'preparing_publish' });
    const publishedAt = publishOptions.schedule || new Date().toISOString();
    const channels = publishOptions.channels || ['default'];
    
    // Step 5: Update content with publishing info
    await run.note(runId, { phase: 'updating_content' });
    const now = new Date().toISOString();
    
    const publishedContent = {
      ...content,
      status: 'active', // Published content is active (per schema)
      published_at: publishedAt,
      published_by: runId,
      channels: channels,
      related_content: relatedContent.map(c => c.id),
      version: (content.version || 0) + 1,
      created_at: content.created_at || now,
      updated_at: now
    };
    
    await repo.write(contentId, publishedContent, runId);
    console.log(`✅ Content published to channels: ${channels.join(', ')}`);
    
    // Step 6: Create release note
    await run.note(runId, { 
      phase: 'publish_complete',
      content_id: contentId,
      channels: channels,
      related_count: relatedContent.length,
      published_at: publishedAt
    });
    
    await run.finish(runId, 'succeeded');
    
    console.log('\n✅ Content publishing completed successfully');
    return {
      status: 'active', // Published = active in schema
      runId,
      content: publishedContent,
      relatedContentCount: relatedContent.length,
      channels
    };
    
  } catch (error) {
    console.error('\n❌ Publishing failed:', error.message);
    
    if (runId) {
      await run.finish(runId, 'failed').catch(() => {});
    }
    
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  const startTime = Date.now();
  
  // Get content ID from command line args or use default
  const contentId = process.argv[2] || 'content-blog-post-001';
  const channels = process.argv[3] ? process.argv[3].split(',') : ['web', 'email'];
  
  publishContentWorkflow(contentId, { channels })
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

module.exports = { publishContentWorkflow };