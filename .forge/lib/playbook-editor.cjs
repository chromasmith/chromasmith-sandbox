// GitHub Playbook Editor
// Conversational editing with safety validation and plan gates

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class PlaybookEditor {
  constructor() {
    this.playbooksPath = path.join(__dirname, '../..', 'playbooks');
    this.draftPlanPath = path.join(__dirname, '..', 'context', 'DRAFT_PLAN.md');
    this.executedPlansPath = path.join(__dirname, '..', 'context', '_executed');
  }
  
  async readChunk(chunkId) {
    const manifestPath = path.join(this.playbooksPath, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    
    const chunk = manifest.chunks.find(c => c.id === chunkId);
    if (!chunk) {
      throw new Error(`Chunk not found: ${chunkId}`);
    }
    
    const chunkPath = path.join(this.playbooksPath, chunk.file);
    const content = await fs.readFile(chunkPath, 'utf8');
    
    return {
      id: chunk.id,
      file: chunk.file,
      path: chunkPath,
      content,
      hash: crypto.createHash('sha256').update(content).digest('hex').substring(0, 8)
    };
  }
  
  async updateChunk(chunkId, newContent, reason) {
    const chunk = await this.readChunk(chunkId);
    
    // Safety check: Validate markdown structure
    if (!this.validateMarkdown(newContent)) {
      throw new Error('Invalid markdown structure');
    }
    
    // Write new content
    await fs.writeFile(chunk.path, newContent, 'utf8');
    
    // Update manifest hash
    await this.updateManifestHash(chunkId, newContent);
    
    return {
      chunkId,
      file: chunk.file,
      oldHash: chunk.hash,
      newHash: crypto.createHash('sha256').update(newContent).digest('hex').substring(0, 8),
      reason
    };
  }
  
  validateMarkdown(content) {
    // Basic markdown validation
    if (!content || typeof content !== 'string') return false;
    if (content.trim().length === 0) return false;
    
    // Should have at least one header
    if (!content.match(/^#+ /m)) return false;
    
    return true;
  }
  
  async updateManifestHash(chunkId, content) {
    const manifestPath = path.join(this.playbooksPath, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    
    const chunk = manifest.chunks.find(c => c.id === chunkId);
    if (chunk) {
      chunk.sha256 = crypto.createHash('sha256').update(content).digest('hex');
    }
    
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }
  
  async generateDraftPlan(changes) {
    const timestamp = new Date().toISOString();
    
    let plan = `# DRAFT PLAN\n\n`;
    plan += `**Generated:** ${timestamp}\n\n`;
    plan += `## Intent\n\n${changes.intent}\n\n`;
    plan += `## Affected Files\n\n`;
    
    const newFiles = changes.files.filter(f => f.action === 'create');
    const modifiedFiles = changes.files.filter(f => f.action === 'modify');
    const deletedFiles = changes.files.filter(f => f.action === 'delete');
    
    if (newFiles.length > 0) {
      plan += `### New Files (${newFiles.length})\n\n`;
      for (const file of newFiles) {
        plan += `- \`${file.path}\`\n`;
      }
      plan += `\n`;
    }
    
    if (modifiedFiles.length > 0) {
      plan += `### Modified Files (${modifiedFiles.length})\n\n`;
      for (const file of modifiedFiles) {
        plan += `- \`${file.path}\`\n`;
      }
      plan += `\n`;
    }
    
    if (deletedFiles.length > 0) {
      plan += `### Deleted Files (${deletedFiles.length})\n\n`;
      for (const file of deletedFiles) {
        plan += `- \`${file.path}\`\n`;
      }
      plan += `\n`;
    }
    
    plan += `## Operations Sequence\n\n`;
    for (let i = 0; i < changes.operations.length; i++) {
      const op = changes.operations[i];
      plan += `${i + 1}. \`${op.verb}(${op.params})\`\n`;
    }
    plan += `\n`;
    
    plan += `## Safety Checks\n\n`;
    for (const check of changes.safetyChecks) {
      plan += `- ${check.passed ? '✅' : '⚠️'} ${check.description}\n`;
    }
    plan += `\n`;
    
    if (changes.warnings && changes.warnings.length > 0) {
      plan += `## Warnings\n\n`;
      for (const warning of changes.warnings) {
        plan += `- ⚠️ ${warning}\n`;
      }
      plan += `\n`;
    }
    
    // Ensure context directory exists
    const contextDir = path.join(__dirname, '..', 'context');
    await fs.mkdir(contextDir, { recursive: true });
    
    await fs.writeFile(this.draftPlanPath, plan, 'utf8');
    
    return { planPath: this.draftPlanPath, plan };
  }
  
  async executePlan(planPath, approved = false) {
    if (!approved) {
      throw new Error('Plan execution requires explicit approval');
    }
    
    const plan = await fs.readFile(planPath, 'utf8');
    
    // Archive executed plan
    await fs.mkdir(this.executedPlansPath, { recursive: true });
    const archiveName = `plan_${Date.now()}.md`;
    const archivePath = path.join(this.executedPlansPath, archiveName);
    await fs.writeFile(archivePath, plan, 'utf8');
    
    // Remove draft plan
    await fs.unlink(planPath);
    
    return { archived: archivePath, executed: true };
  }
  
  needsPlanGate(changes) {
    // Require plan gate if:
    // 1. Multiple files modified (≥2 files)
    // 2. Schema changes detected
    // 3. Migration changes detected
    // 4. Infrastructure changes detected
    
    const fileCount = changes.files.length;
    if (fileCount >= 2) return true;
    
    const hasSchema = changes.files.some(f => f.path.includes('_schema'));
    if (hasSchema) return true;
    
    const hasMigration = changes.files.some(f => f.path.includes('_migrations'));
    if (hasMigration) return true;
    
    const hasInfra = changes.files.some(f => 
      f.path.includes('vercel') || 
      f.path.includes('supabase') ||
      f.path.includes('providers')
    );
    if (hasInfra) return true;
    
    return false;
  }
}

module.exports = { PlaybookEditor };