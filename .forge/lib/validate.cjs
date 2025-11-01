/**
 * Forge Flow 6.4 - Schema Validation Module
 * Validates maps against JSON schemas before writes
 * Part of Pillar 3: Safety Guardrails
 */

const fs = require('fs').promises;
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const FORGE_ROOT = path.join(__dirname, '..');
const SCHEMA_ROOT = path.join(FORGE_ROOT, '_schema');

// Initialize AJV with schema caching
const ajv = new Ajv({ 
  allErrors: true,
  verbose: true,
  schemas: []
});
addFormats(ajv);

let schemasLoaded = false;

/**
 * Load all schemas from _schema directory
 */
async function loadSchemas() {
  if (schemasLoaded) return;
  
  try {
    const files = await fs.readdir(SCHEMA_ROOT);
    const schemaFiles = files.filter(f => f.endsWith('.schema.json'));
    
    for (const file of schemaFiles) {
      const schemaPath = path.join(SCHEMA_ROOT, file);
      const schemaContent = await fs.readFile(schemaPath, 'utf8');
      const schema = JSON.parse(schemaContent);
      
      // Add schema to AJV
      ajv.addSchema(schema, file.replace('.schema.json', ''));
    }
    
    schemasLoaded = true;
    console.log(`✅ Loaded ${schemaFiles.length} schemas`);
  } catch (error) {
    throw new Error(`Failed to load schemas: ${error.message}`);
  }
}

/**
 * Validate a map against its schema
 * @param {object} map - Map to validate
 * @param {string} schemaType - Schema type (base-map, feature-map, etc)
 * @returns {object} { valid: boolean, errors: [] }
 */
async function validateMap(map, schemaType = 'base-map') {
  await loadSchemas();
  
  const validate = ajv.getSchema(schemaType);
  if (!validate) {
    throw new Error(`Schema not found: ${schemaType}`);
  }
  
  const valid = validate(map);
  
  return {
    valid,
    errors: valid ? [] : validate.errors.map(err => ({
      field: err.instancePath || err.params?.missingProperty,
      message: err.message,
      constraint: err.keyword
    }))
  };
}

/**
 * Validate and throw if invalid
 * @param {object} map - Map to validate
 * @param {string} schemaType - Schema type
 */
async function validateOrThrow(map, schemaType = 'base-map') {
  const result = await validateMap(map, schemaType);
  
  if (!result.valid) {
    const errorMessages = result.errors
      .map(e => `${e.field}: ${e.message}`)
      .join(', ');
    throw new Error(`Schema validation failed: ${errorMessages}`);
  }
  
  return true;
}

module.exports = {
  validateMap,
  validateOrThrow,
  loadSchemas
};