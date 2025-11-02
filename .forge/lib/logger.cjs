/**
 * Structured Logger for Forge Flow 6.4
 * Production-ready logging with levels, context, and correlation
 */

const fs = require('fs');
const path = require('path');

/**
 * Log levels
 */
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

const LogLevelNames = {
  0: 'DEBUG',
  1: 'INFO',
  2: 'WARN',
  3: 'ERROR',
  4: 'FATAL'
};

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG = {
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: true,
  logDir: '.forge/logs',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  pretty: false,
  includeStack: true
};

/**
 * Logger class
 */
class Logger {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.context = {};
    this.correlationId = null;
    
    // Ensure log directory exists
    if (this.config.enableFile) {
      this.ensureLogDir();
    }
  }
  
  /**
   * Set persistent context for all logs
   */
  setContext(context) {
    this.context = { ...this.context, ...context };
  }
  
  /**
   * Clear context
   */
  clearContext() {
    this.context = {};
  }
  
  /**
   * Set correlation ID for request tracking
   */
  setCorrelationId(id) {
    this.correlationId = id;
  }
  
  /**
   * Clear correlation ID
   */
  clearCorrelationId() {
    this.correlationId = null;
  }
  
  /**
   * Create child logger with inherited context
   */
  child(context) {
    const child = new Logger(this.config);
    child.context = { ...this.context, ...context };
    child.correlationId = this.correlationId;
    return child;
  }
  
  /**
   * Core logging method
   */
  log(level, message, meta = {}) {
    // Check if level is enabled
    if (level < this.config.level) return;
    
    const entry = {
      timestamp: new Date().toISOString(),
      level: LogLevelNames[level],
      message,
      ...this.context,
      ...meta
    };
    
    // Add correlation ID if set
    if (this.correlationId) {
      entry.correlationId = this.correlationId;
    }
    
    // Add error stack if present
    if (meta.error && this.config.includeStack) {
      entry.stack = meta.error.stack;
      entry.errorCode = meta.error.code;
    }
    
    // Console output
    if (this.config.enableConsole) {
      this.logToConsole(level, entry);
    }
    
    // File output
    if (this.config.enableFile) {
      this.logToFile(entry);
    }
  }
  
  /**
   * Log to console with colors
   */
  logToConsole(level, entry) {
    const colors = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m', // Red
      FATAL: '\x1b[35m'  // Magenta
    };
    const reset = '\x1b[0m';
    
    if (this.config.pretty) {
      const color = colors[entry.level] || '';
      console.log(
        `${color}[${entry.timestamp}] ${entry.level}${reset} ${entry.message}`,
        Object.keys(entry).length > 3 ? entry : ''
      );
    } else {
      console.log(JSON.stringify(entry));
    }
  }
  
  /**
   * Log to file
   */
  logToFile(entry) {
    const logFile = path.join(this.config.logDir, 'forge-flow.log');
    const line = JSON.stringify(entry) + '\n';
    
    try {
      // Check file size and rotate if needed
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size >= this.config.maxFileSize) {
          this.rotateLogFile();
        }
      }
      
      fs.appendFileSync(logFile, line);
    } catch (error) {
      console.error('Failed to write log:', error.message);
    }
  }
  
  /**
   * Rotate log files
   */
  rotateLogFile() {
    const logFile = path.join(this.config.logDir, 'forge-flow.log');
    
    // Shift existing rotated logs
    for (let i = this.config.maxFiles - 1; i > 0; i--) {
      const current = `${logFile}.${i}`;
      const next = `${logFile}.${i + 1}`;
      
      if (fs.existsSync(current)) {
        if (i === this.config.maxFiles - 1) {
          fs.unlinkSync(current);
        } else {
          fs.renameSync(current, next);
        }
      }
    }
    
    // Rotate current log
    if (fs.existsSync(logFile)) {
      fs.renameSync(logFile, `${logFile}.1`);
    }
  }
  
  /**
   * Ensure log directory exists
   */
  ensureLogDir() {
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }
  }
  
  /**
   * Convenience methods
   */
  debug(message, meta) {
    this.log(LogLevel.DEBUG, message, meta);
  }
  
  info(message, meta) {
    this.log(LogLevel.INFO, message, meta);
  }
  
  warn(message, meta) {
    this.log(LogLevel.WARN, message, meta);
  }
  
  error(message, meta) {
    this.log(LogLevel.ERROR, message, meta);
  }
  
  fatal(message, meta) {
    this.log(LogLevel.FATAL, message, meta);
  }
}

// Singleton instance
let instance = null;

function getLogger(config) {
  if (!instance) {
    instance = new Logger(config);
  }
  return instance;
}

module.exports = {
  LogLevel,
  Logger,
  getLogger
};
