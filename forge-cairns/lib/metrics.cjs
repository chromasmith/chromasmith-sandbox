/**
 * Metrics Collection for Forge Flow 6.4
 * Lightweight metrics tracking for observability
 */

/**
 * Metric types
 */
const MetricType = {
  COUNTER: 'counter',       // Incrementing value
  GAUGE: 'gauge',           // Current value
  HISTOGRAM: 'histogram',   // Distribution of values
  TIMER: 'timer'            // Duration tracking
};

/**
 * Metrics Registry
 */
class MetricsRegistry {
  constructor() {
    this.metrics = new Map();
    this.startTime = Date.now();
  }
  
  /**
   * Register a metric
   */
  register(name, type, description = '') {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        type,
        description,
        value: type === MetricType.HISTOGRAM ? [] : 0,
        lastUpdated: null,
        labels: new Map()
      });
    }
  }
  
  /**
   * Increment a counter
   */
  increment(name, labels = {}, value = 1) {
    this.register(name, MetricType.COUNTER);
    const metric = this.getMetric(name, labels);
    metric.value += value;
    metric.lastUpdated = Date.now();
  }
  
  /**
   * Set a gauge value
   */
  set(name, labels = {}, value) {
    this.register(name, MetricType.GAUGE);
    const metric = this.getMetric(name, labels);
    metric.value = value;
    metric.lastUpdated = Date.now();
  }
  
  /**
   * Record a value in histogram
   */
  record(name, labels = {}, value) {
    this.register(name, MetricType.HISTOGRAM);
    const metric = this.getMetric(name, labels);
    
    if (!Array.isArray(metric.value)) {
      metric.value = [];
    }
    
    metric.value.push({
      value,
      timestamp: Date.now()
    });
    
    // Keep last 1000 values
    if (metric.value.length > 1000) {
      metric.value.shift();
    }
    
    metric.lastUpdated = Date.now();
  }
  
  /**
   * Start a timer
   */
  startTimer(name, labels = {}) {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.record(name, labels, duration);
      return duration;
    };
  }
  
  /**
   * Get metric with labels
   */
  getMetric(name, labels) {
    const base = this.metrics.get(name);
    if (!base) {
      throw new Error(`Metric ${name} not registered`);
    }
    
    // Handle unlabeled metrics
    if (Object.keys(labels).length === 0) {
      return base;
    }
    
    // Get or create labeled metric
    const labelKey = this.getLabelKey(labels);
    if (!base.labels.has(labelKey)) {
      base.labels.set(labelKey, {
        labels,
        value: base.type === MetricType.HISTOGRAM ? [] : 0,
        lastUpdated: null
      });
    }
    
    return base.labels.get(labelKey);
  }
  
  /**
   * Get label key for storage
   */
  getLabelKey(labels) {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }
  
  /**
   * Get all metrics
   */
  getAll() {
    const result = {};
    
    for (const [name, metric] of this.metrics) {
      result[name] = {
        type: metric.type,
        description: metric.description,
        value: this.formatValue(metric),
        lastUpdated: metric.lastUpdated
      };
      
      // Include labeled metrics
      if (metric.labels.size > 0) {
        result[name].labels = {};
        for (const [labelKey, labeledMetric] of metric.labels) {
          result[name].labels[labelKey] = {
            labels: labeledMetric.labels,
            value: this.formatValue(labeledMetric, metric.type),
            lastUpdated: labeledMetric.lastUpdated
          };
        }
      }
    }
    
    // Add system metrics
    result._system = {
      uptime: Date.now() - this.startTime,
      timestamp: Date.now()
    };
    
    return result;
  }
  
  /**
   * Format metric value based on type
   */
  formatValue(metric, type) {
    const metricType = type || metric.type;
    if (metricType === MetricType.HISTOGRAM) {
      return this.calculateHistogramStats(metric.value);
    }
    return metric.value;
  }
  
  /**
   * Calculate histogram statistics
   */
  calculateHistogramStats(values) {
    if (!values || values.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }
    
    const sorted = values.map(v => v.value).sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    
    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
  
  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.clear();
  }
  
  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus() {
    const lines = [];
    
    for (const [name, metric] of this.metrics) {
      // Type and help
      lines.push(`# HELP ${name} ${metric.description}`);
      lines.push(`# TYPE ${name} ${metric.type}`);
      
      // Base metric
      if (metric.type === MetricType.HISTOGRAM) {
        const stats = this.calculateHistogramStats(metric.value);
        lines.push(`${name}_count ${stats.count}`);
        lines.push(`${name}_sum ${stats.avg * stats.count}`);
        lines.push(`${name}_bucket{le="0.5"} ${stats.p50}`);
        lines.push(`${name}_bucket{le="0.95"} ${stats.p95}`);
        lines.push(`${name}_bucket{le="0.99"} ${stats.p99}`);
        lines.push(`${name}_bucket{le="+Inf"} ${stats.max}`);
      } else {
        lines.push(`${name} ${metric.value}`);
      }
      
      // Labeled metrics
      for (const [labelKey, labeledMetric] of metric.labels) {
        const labelStr = Object.entries(labeledMetric.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        
        if (metric.type === MetricType.HISTOGRAM) {
          const stats = this.calculateHistogramStats(labeledMetric.value);
          lines.push(`${name}_count{${labelStr}} ${stats.count}`);
          lines.push(`${name}_sum{${labelStr}} ${stats.avg * stats.count}`);
        } else {
          lines.push(`${name}{${labelStr}} ${labeledMetric.value}`);
        }
      }
      
      lines.push('');
    }
    
    return lines.join('\n');
  }
}

// Singleton instance
let instance = null;

function getMetrics() {
  if (!instance) {
    instance = new MetricsRegistry();
  }
  return instance;
}

module.exports = {
  MetricType,
  MetricsRegistry,
  getMetrics
};
