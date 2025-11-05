/**
 * Forge Stubs - Main Module
 * Provides sample demo data without external service dependencies
 */

const fs = require('fs');
const path = require('path');

// Load manifest
const manifestPath = path.join(__dirname, 'nstub.manifest.json');
let manifest = null;

function loadManifest() {
  if (!manifest) {
    const data = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(data);
  }
  return manifest;
}

// Generator map
const generators = {
  blog: require('./generators/blog.cjs'),
  products: require('./generators/products.cjs'),
  users: require('./generators/users.cjs')
};

/**
 * Get the full manifest
 * @returns {Object} The complete manifest with all dataset definitions
 */
function stubs_get_manifest() {
  return loadManifest();
}

/**
 * List available datasets
 * @returns {Array<Object>} Array of dataset info objects
 */
function stubs_list() {
  const m = loadManifest();
  return Object.entries(m.datasets).map(([key, value]) => ({
    name: key,
    description: value.description,
    count: value.count,
    schema: value.schema
  }));
}

/**
 * Generate sample data for a dataset
 * @param {string} dataset - Dataset name (blog, products, users)
 * @param {number} count - Number of items to generate (default: 10)
 * @param {number} seed - Optional seed for deterministic generation (default: 0)
 * @returns {Array<Object>} Array of generated data items
 * @throws {Error} If dataset is invalid or count is out of bounds
 */
function stubs_sample(dataset, count = 10, seed = 0) {
  const m = loadManifest();
  
  // Validate dataset
  if (!m.datasets[dataset]) {
    const available = Object.keys(m.datasets).join(', ');
    throw new Error(
      `Invalid dataset: "${dataset}". Available datasets: ${available}`
    );
  }
  
  // Validate count
  const maxCount = m.datasets[dataset].count;
  if (count < 1) {
    throw new Error(`Count must be at least 1, got ${count}`);
  }
  if (count > maxCount) {
    throw new Error(
      `Count ${count} exceeds maximum ${maxCount} for dataset "${dataset}"`
    );
  }
  
  // Get generator
  const generator = generators[dataset];
  if (!generator) {
    throw new Error(`No generator found for dataset: ${dataset}`);
  }
  
  // Generate data
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(generator.generate(i, seed));
  }
  
  return results;
}

module.exports = {
  sample: stubs_sample,
  list: stubs_list,
  get_manifest: stubs_get_manifest
};
