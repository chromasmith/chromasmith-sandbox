#!/usr/bin/env node
/**
 * Forge Dashboard Test Suite
 * Tests core server functionality and API endpoints
 */

const http = require('http');

const PORT = 9003;
const HOST = 'localhost';
let testsPassed = 0;
let testsFailed = 0;

// Test helper
async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    testsFailed++;
  }
}

// HTTP request helper
function httpGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${HOST}:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error('Invalid JSON response'));
          }
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Check if server is running
async function checkServer() {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${HOST}:${PORT}/`, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 304);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Run tests
async function runTests() {
  console.log('\n=== Forge Dashboard Test Suite ===\n');
  
  // Check if server is running
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.error('✗ Server not running on port 9003');
    console.error('\nPlease start the server: node forge-dashboard/index.cjs\n');
    process.exit(1);
  }
  
  console.log('✓ Server is running on port 9003\n');
  
  // Test 1: Health endpoint
  await test('GET /api/health returns JSON with modules array', async () => {
    const data = await httpGet('/api/health');
    if (!data.modules || !Array.isArray(data.modules)) {
      throw new Error('Response missing modules array');
    }
    if (!data.summary) {
      throw new Error('Response missing summary object');
    }
  });
  
  // Test 2: Audit endpoint
  await test('GET /api/audit returns array', async () => {
    const data = await httpGet('/api/audit');
    if (!Array.isArray(data)) {
      throw new Error('Response is not an array');
    }
  });
  
  // Test 3: DLQ endpoint
  await test('GET /api/dlq returns stats object', async () => {
    const data = await httpGet('/api/dlq');
    if (typeof data !== 'object' || data === null) {
      throw new Error('Response is not an object');
    }
    if (!('total' in data) || !('byModule' in data)) {
      throw new Error('Response missing required fields');
    }
  });
  
  // Test 4: Events endpoint
  await test('GET /api/events returns array', async () => {
    const data = await httpGet('/api/events');
    if (!Array.isArray(data)) {
      throw new Error('Response is not an array');
    }
  });
  
  // Results
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log(`Total:  ${testsPassed + testsFailed}\n`);
  
  if (testsFailed > 0) {
    console.error('❌ Tests failed\n');
    process.exit(1);
  } else {
    console.log('✅ All tests passed\n');
    process.exit(0);
  }
}

// Run
runTests().catch(err => {
  console.error('\n❌ Test suite error:', err.message, '\n');
  process.exit(1);
});
