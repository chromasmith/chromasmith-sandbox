// Notification Manager
// Honors notifications.yml and implements aggregation windows

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');

class NotificationManager {
  constructor() {
    this.configPath = path.join(__dirname, '..', 'notifications.yml');
    this.queuePath = path.join(__dirname, '..', 'status', 'notification_queue.json');
    this.config = null;
    this.queue = [];
  }
  
  async loadConfig() {
    if (this.config) return this.config;
    
    const content = await fs.readFile(this.configPath, 'utf8');
    this.config = yaml.parse(content);
    return this.config;
  }
  
  async loadQueue() {
    try {
      const content = await fs.readFile(this.queuePath, 'utf8');
      this.queue = JSON.parse(content);
    } catch {
      this.queue = [];
    }
    return this.queue;
  }
  
  async saveQueue() {
    const statusDir = path.dirname(this.queuePath);
    await fs.mkdir(statusDir, { recursive: true });
    await fs.writeFile(this.queuePath, JSON.stringify(this.queue, null, 2), 'utf8');
  }
  
  findRule(eventType) {
    const config = this.config || { rules: [] };
    return config.rules.find(r => r.event_type === eventType);
  }
  
  async notify(event) {
    await this.loadConfig();
    await this.loadQueue();
    
    const rule = this.findRule(event.type);
    
    if (!rule) {
      // No rule for this event type - use default console logging
      this.sendToConsole(event, true);
      return { sent: true, channels: ['console'], immediate: true };
    }
    
    const timestamp = new Date().toISOString();
    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      event,
      rule,
      timestamp,
      sent: false
    };
    
    if (rule.immediate) {
      // Send immediately
      await this.send(notification);
      return { sent: true, channels: rule.channels, immediate: true };
    } else if (rule.aggregation) {
      // Queue for aggregation
      this.queue.push(notification);
      await this.saveQueue();
      return { queued: true, window: rule.window, immediate: false };
    } else {
      // Send without aggregation
      await this.send(notification);
      return { sent: true, channels: rule.channels, immediate: false };
    }
  }
  
  async send(notification) {
    const channels = notification.rule.channels;
    
    for (const channel of channels) {
      switch (channel) {
        case 'console':
          this.sendToConsole(notification.event, notification.rule.immediate);
          break;
        case 'email':
          await this.sendToEmail(notification);
          break;
        case 'slack':
          await this.sendToSlack(notification);
          break;
      }
    }
    
    notification.sent = true;
    notification.sent_at = new Date().toISOString();
  }
  
  sendToConsole(event, immediate) {
    const prefix = immediate ? '🚨' : '📢';
    console.log(`${prefix} [${event.type}] ${event.message || JSON.stringify(event.data)}`);
  }
  
  async sendToEmail(notification) {
    const config = this.config;
    
    if (!config.channels.email.enabled) {
      return { skipped: true, reason: 'Email channel disabled' };
    }
    
    // Email sending would go here (Resend, SendGrid, etc.)
    console.log(`📧 [EMAIL] Would send to: ${config.channels.email.recipients.join(', ')}`);
    return { sent: true, channel: 'email' };
  }
  
  async sendToSlack(notification) {
    const config = this.config;
    
    if (!config.channels.slack.enabled) {
      return { skipped: true, reason: 'Slack channel disabled' };
    }
    
    // Slack webhook would go here
    console.log(`💬 [SLACK] Would send to webhook`);
    return { sent: true, channel: 'slack' };
  }
  
  async flushWindow(windowName, options = {}) {
    await this.loadConfig();
    await this.loadQueue();
    
    const windowConfig = this.config.aggregation.windows[windowName];
    if (!windowConfig) {
      throw new Error(`Unknown window: ${windowName}`);
    }
    
    // Find notifications for this window
    const notifications = this.queue.filter(n => n.rule.window === windowName);
    
    if (notifications.length === 0) {
      return { flushed: 0, window: windowName };
    }
    
    // Check if window criteria met (unless force=true)
    const oldestTimestamp = new Date(notifications[0].timestamp);
    const now = new Date();
    const ageMinutes = (now - oldestTimestamp) / (1000 * 60);
    
    const shouldFlush = 
      options.force === true ||
      notifications.length >= windowConfig.max_count ||
      ageMinutes >= windowConfig.duration_minutes;
    
    if (!shouldFlush) {
      return { flushed: 0, window: windowName, reason: 'Window criteria not met', count: notifications.length };
    }
    
    // Send aggregated notification
    await this.sendAggregated(windowName, notifications);
    
    // Remove from queue
    this.queue = this.queue.filter(n => n.rule.window !== windowName);
    await this.saveQueue();
    
    return { flushed: notifications.length, window: windowName };
  }
  
  async sendAggregated(windowName, notifications) {
    const summary = {
      window: windowName,
      count: notifications.length,
      events: notifications.map(n => ({
        type: n.event.type,
        timestamp: n.timestamp,
        message: n.event.message
      }))
    };
    
    console.log(`📦 [AGGREGATED - ${windowName}] ${notifications.length} events:`);
    for (const notif of notifications) {
      console.log(`   - ${notif.event.type}: ${notif.event.message || 'no message'}`);
    }
    
    // Send via configured channels
    const firstRule = notifications[0].rule;
    for (const channel of firstRule.channels) {
      if (channel === 'email' && this.config.channels.email.enabled) {
        console.log(`   📧 Sent aggregated email`);
      }
      if (channel === 'slack' && this.config.channels.slack.enabled) {
        console.log(`   💬 Sent aggregated Slack message`);
      }
    }
  }
  
  async getQueueStatus() {
    await this.loadQueue();
    await this.loadConfig();
    
    const windows = {};
    
    for (const [windowName, windowConfig] of Object.entries(this.config.aggregation.windows)) {
      const notifications = this.queue.filter(n => n.rule.window === windowName);
      
      windows[windowName] = {
        count: notifications.length,
        max_count: windowConfig.max_count,
        duration_minutes: windowConfig.duration_minutes,
        should_flush: notifications.length >= windowConfig.max_count
      };
    }
    
    return {
      total_queued: this.queue.length,
      windows
    };
  }
}

module.exports = { NotificationManager };
