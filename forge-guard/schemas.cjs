const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// Schema definitions
const schemas = {
  build_prepare_forgeview: {
    type: 'object',
    required: ['repo_name', 'channel'],
    properties: {
      repo_name: {
        type: 'string',
        pattern: '^[a-z0-9-]+$'
      },
      temp_allowed: {
        type: 'boolean'
      },
      channel: {
        type: 'string',
        enum: ['1', '2']
      }
    },
    additionalProperties: false
  },
  
  build_deploy_preview: {
    type: 'object',
    required: ['repo_name', 'confirm_token'],
    properties: {
      repo_name: {
        type: 'string',
        pattern: '^[a-z0-9-]+$'
      },
      confirm_token: {
        type: 'string',
        pattern: '^tok_[a-z0-9]+$'
      }
    },
    additionalProperties: false
  },
  
  build_deploy_production: {
    type: 'object',
    required: ['repo_name', 'domain', 'confirm_token'],
    properties: {
      repo_name: {
        type: 'string',
        pattern: '^[a-z0-9-]+$'
      },
      domain: {
        type: 'string',
        pattern: '^[a-z0-9.-]+\\.[a-z]{2,}$'
      },
      confirm_token: {
        type: 'string',
        pattern: '^tok_[a-z0-9]+$'
      }
    },
    additionalProperties: false
  }
};

// Compile schemas
const compiledSchemas = {};
for (const [name, schema] of Object.entries(schemas)) {
  compiledSchemas[name] = ajv.compile(schema);
}

/**
 * Validate payload against schema
 * @param {string} schemaName - Name of schema to validate against
 * @param {object} payload - Payload to validate
 * @returns {object} { valid: boolean, errors?: array }
 */
function validate(schemaName, payload) {
  const validateFn = compiledSchemas[schemaName];
  
  if (!validateFn) {
    return {
      valid: false,
      errors: [{ message: `Unknown schema: ${schemaName}` }]
    };
  }
  
  const valid = validateFn(payload);
  
  if (!valid) {
    return {
      valid: false,
      errors: validateFn.errors
    };
  }
  
  return { valid: true };
}

module.exports = {
  validate,
  schemas
};
