// No-op metrics (replace later with your real metrics)
module.exports = {
  incr: (name, v = 1, labels = {}) => void 0,
  timing: (name, ms, labels = {}) => void 0,
  gauge: (name, v, labels = {}) => void 0,
};

