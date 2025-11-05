/**
 * Error Taxonomy for Forge Flow 6.4
 * Defines standard error codes, categories, and retry policies
 */

const ErrorCategory = {
  TRANSIENT: 'TRANSIENT',       // Temporary, retry automatically
  PERMANENT: 'PERMANENT',        // Persistent, don't retry
  VALIDATION: 'VALIDATION',      // User input error
  CONFIGURATION: 'CONFIGURATION', // System misconfiguration
  SECURITY: 'SECURITY',          // Auth/permission issues
  RESOURCE: 'RESOURCE',          // Resource limits/quotas
  NETWORK: 'NETWORK',            // Network connectivity
  DEPENDENCY: 'DEPENDENCY'       // External service failures
};

const ErrorCode = {
  // Transient errors (retry)
  PROVIDER_RATE_LIMIT: { code: 'PROVIDER_RATE_LIMIT', category: ErrorCategory.TRANSIENT, retryable: true },
  NETWORK_TIMEOUT: { code: 'NETWORK_TIMEOUT', category: ErrorCategory.NETWORK, retryable: true },
  TRANSIENT_5XX: { code: 'TRANSIENT_5XX', category: ErrorCategory.TRANSIENT, retryable: true },
  CONNECTION_REFUSED: { code: 'CONNECTION_REFUSED', category: ErrorCategory.NETWORK, retryable: true },
  SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', category: ErrorCategory.DEPENDENCY, retryable: true },
  
  // Permanent errors (don't retry)
  INVALID_CREDENTIALS: { code: 'INVALID_CREDENTIALS', category: ErrorCategory.SECURITY, retryable: false },
  SCHEMA_VIOLATION: { code: 'SCHEMA_VIOLATION', category: ErrorCategory.VALIDATION, retryable: false },
  QUOTA_EXCEEDED_HARD: { code: 'QUOTA_EXCEEDED_HARD', category: ErrorCategory.RESOURCE, retryable: false },
  PERMISSION_DENIED: { code: 'PERMISSION_DENIED', category: ErrorCategory.SECURITY, retryable: false },
  NOT_FOUND: { code: 'NOT_FOUND', category: ErrorCategory.PERMANENT, retryable: false },
  BAD_REQUEST: { code: 'BAD_REQUEST', category: ErrorCategory.VALIDATION, retryable: false },
  
  // Configuration errors
  MISSING_CONFIG: { code: 'MISSING_CONFIG', category: ErrorCategory.CONFIGURATION, retryable: false },
  INVALID_CONFIG: { code: 'INVALID_CONFIG', category: ErrorCategory.CONFIGURATION, retryable: false },
  
  // Safe mode
  SAFE_MODE_READ_ONLY: { code: 'SAFE_MODE_READ_ONLY', category: ErrorCategory.SECURITY, retryable: false },
  
  // Context errors
  CONTEXT_BUDGET_EXCEEDED: { code: 'CONTEXT_BUDGET_EXCEEDED', category: ErrorCategory.RESOURCE, retryable: false }
};

/**
 * Standard error class for Forge Flow
 */
class ForgeFlowError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ForgeFlowError';
    
    const errorDef = ErrorCode[code] || { 
      code, 
      category: ErrorCategory.PERMANENT, 
      retryable: false 
    };
    
    this.code = errorDef.code;
    this.category = errorDef.category;
    this.retryable = errorDef.retryable;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
  
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      retryable: this.retryable,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Map HTTP status codes to error codes
 */
function mapHttpStatus(status, defaultCode = 'TRANSIENT_5XX') {
  if (status === 429) return 'PROVIDER_RATE_LIMIT';
  if (status === 401 || status === 403) return 'INVALID_CREDENTIALS';
  if (status === 404) return 'NOT_FOUND';
  if (status === 400) return 'BAD_REQUEST';
  if (status >= 500 && status < 600) return 'TRANSIENT_5XX';
  return defaultCode;
}

/**
 * Check if error is retryable
 */
function isRetryable(error) {
  if (error instanceof ForgeFlowError) {
    return error.retryable;
  }
  
  // Check by code property
  if (error.code && ErrorCode[error.code]) {
    return ErrorCode[error.code].retryable;
  }
  
  // Default: network/timeout errors are retryable
  const retryablePatterns = [
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /ENOTFOUND/i,
    /NETWORK/i,
    /TIMEOUT/i,
    /rate.?limit/i,
    /503/,
    /502/,
    /504/
  ];
  
  const errorStr = error.message || error.toString();
  return retryablePatterns.some(pattern => pattern.test(errorStr));
}

module.exports = {
  ErrorCategory,
  ErrorCode,
  ForgeFlowError,
  mapHttpStatus,
  isRetryable
};