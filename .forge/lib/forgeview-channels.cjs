// ForgeView Two-Channel Manager
// Manages state for dual-channel preview system

const fs = require('fs').promises;
const path = require('path');

class ChannelManager {
  constructor() {
    this.stateFile = path.join(__dirname, '..', 'status', 'forgeview.json');
    this.channels = [
      { id: 1, port: 5173, role: 'primary', url: 'forgeview://channel/1' },
      { id: 2, port: 5174, role: 'secondary', url: 'forgeview://channel/2' }
    ];
  }
  
  async loadState() {
    try {
      const content = await fs.readFile(this.stateFile, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      // Return default state if file doesn't exist
      return {
        channels: {
          1: { loaded: null, dirty: false, last_updated: null },
          2: { loaded: null, dirty: false, last_updated: null }
        },
        focus: 1,
        last_operation: null
      };
    }
  }
  
  async saveState(state) {
    const statusDir = path.join(__dirname, '..', 'status');
    await fs.mkdir(statusDir, { recursive: true });
    await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
  }
  
  async getChannelInfo(channelId) {
    const state = await this.loadState();
    const channel = this.channels.find(c => c.id === channelId);
    
    if (!channel) {
      throw new Error(`Invalid channel ID: ${channelId}`);
    }
    
    return {
      ...channel,
      state: state.channels[channelId]
    };
  }
  
  async loadArtifact(channelId, artifactPath, metadata = {}) {
    const state = await this.loadState();
    const timestamp = new Date().toISOString();
    
    state.channels[channelId] = {
      loaded: artifactPath,
      dirty: false,
      last_updated: timestamp,
      metadata
    };
    
    state.focus = channelId;
    state.last_operation = {
      type: 'load',
      channel: channelId,
      artifact: artifactPath,
      timestamp
    };
    
    await this.saveState(state);
    
    return {
      channel: channelId,
      artifact: artifactPath,
      timestamp
    };
  }
  
  async markDirty(channelId, reason) {
    const state = await this.loadState();
    
    state.channels[channelId].dirty = true;
    state.last_operation = {
      type: 'mark_dirty',
      channel: channelId,
      reason,
      timestamp: new Date().toISOString()
    };
    
    await this.saveState(state);
  }
  
  async clearChannel(channelId) {
    const state = await this.loadState();
    
    state.channels[channelId] = {
      loaded: null,
      dirty: false,
      last_updated: new Date().toISOString()
    };
    
    state.last_operation = {
      type: 'clear',
      channel: channelId,
      timestamp: new Date().toISOString()
    };
    
    await this.saveState(state);
  }
  
  async canPromote() {
    const state = await this.loadState();
    
    // Check conflict: both channels dirty
    const bothDirty = state.channels[1].dirty && state.channels[2].dirty;
    
    if (bothDirty) {
      return {
        allowed: false,
        reason: 'Both channels are dirty - resolve conflicts first',
        conflict: true
      };
    }
    
    // Check if channel 2 has content
    if (!state.channels[2].loaded) {
      return {
        allowed: false,
        reason: 'Channel 2 is empty - nothing to promote',
        conflict: false
      };
    }
    
    return {
      allowed: true,
      reason: 'Safe to promote channel 2 to channel 1',
      conflict: false
    };
  }
  
  async promoteChannel2ToChannel1() {
    const canPromoteResult = await this.canPromote();
    
    if (!canPromoteResult.allowed) {
      throw new Error(canPromoteResult.reason);
    }
    
    const state = await this.loadState();
    
    // Copy channel 2 to channel 1
    const channel2Content = state.channels[2];
    state.channels[1] = {
      ...channel2Content,
      last_updated: new Date().toISOString()
    };
    
    // Clear channel 2
    state.channels[2] = {
      loaded: null,
      dirty: false,
      last_updated: new Date().toISOString()
    };
    
    state.focus = 1;
    state.last_operation = {
      type: 'promote',
      from: 2,
      to: 1,
      timestamp: new Date().toISOString()
    };
    
    await this.saveState(state);
    
    return {
      promoted: true,
      artifact: channel2Content.loaded
    };
  }
  
  async smartRoute(intent) {
    const state = await this.loadState();
    
    // Smart routing logic:
    // - Comparisons → Channel 2
    // - Primary work → Channel 1
    // - If both empty → Channel 1
    // - Preserve focus when possible
    
    const keywords = {
      comparison: ['compare', 'versus', 'vs', 'difference', 'side-by-side'],
      reference: ['reference', 'check', 'look at', 'view'],
      primary: ['main', 'current', 'active', 'working']
    };
    
    const intentLower = intent.toLowerCase();
    
    // Check for comparison keywords
    const isComparison = keywords.comparison.some(k => intentLower.includes(k));
    if (isComparison && state.channels[1].loaded) {
      return { channel: 2, reason: 'Comparison request - using secondary channel' };
    }
    
    // Check for reference keywords
    const isReference = keywords.reference.some(k => intentLower.includes(k));
    if (isReference && state.channels[1].loaded) {
      return { channel: 2, reason: 'Reference request - using secondary channel' };
    }
    
    // Default to focused channel, or channel 1 if nothing loaded
    const focusedChannel = state.focus || 1;
    return { 
      channel: focusedChannel, 
      reason: `Default to ${focusedChannel === 1 ? 'primary' : 'focused'} channel` 
    };
  }
  
  async getStatus() {
    const state = await this.loadState();
    
    return {
      channels: [
        {
          id: 1,
          role: 'primary',
          port: 5173,
          loaded: state.channels[1].loaded,
          dirty: state.channels[1].dirty,
          last_updated: state.channels[1].last_updated
        },
        {
          id: 2,
          role: 'secondary',
          port: 5174,
          loaded: state.channels[2].loaded,
          dirty: state.channels[2].dirty,
          last_updated: state.channels[2].last_updated
        }
      ],
      focus: state.focus,
      last_operation: state.last_operation
    };
  }
}

module.exports = { ChannelManager };