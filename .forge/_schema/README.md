# Forge Flow Schema System

## Dependencies Required
```bash
npm install ajv ajv-formats
```

## Schemas
- `base-map.schema.json` - Base schema for all maps
- `feature-map.schema.json` - Extended schema for feature deployments

## Usage
```javascript
const { validateOrThrow } = require('../lib/validate.cjs');
await validateOrThrow(mapData, 'base-map');
```