// No-op logger (replace later with your real logger)
module.exports = {
  info: (...a) => console.log("[INFO]", ...a),
  warn: (...a) => console.warn("[WARN]", ...a),
  error: (...a) => console.error("[ERROR]", ...a),
};

