/**
 * forge-tokens/test-tokens.cjs
 * Test suite for forge-tokens module
 * Run with: node test-tokens.cjs
 */

const tokens = require('./index.cjs');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log(`✓ ${name}`);
  } catch (error) {
    failCount++;
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('Running forge-tokens tests...\n');

// Test 1: Load default theme
test('load_default_theme', () => {
  const result = tokens.tokens_load('default');
  assert(result.success === true, 'Should load default theme successfully');
  assert(result.theme !== undefined, 'Should return theme object');
  assert(result.theme.id === 'default', 'Theme ID should be "default"');
});

// Test 2: Load dark theme
test('load_dark_theme', () => {
  const result = tokens.tokens_load('dark');
  assert(result.success === true, 'Should load dark theme successfully');
  assert(result.theme !== undefined, 'Should return theme object');
  assert(result.theme.id === 'dark', 'Theme ID should be "dark"');
});

// Test 3: Apply theme changes current
test('apply_theme_changes_current', () => {
  const applyResult = tokens.tokens_apply('dark');
  assert(applyResult.success === true, 'Should apply theme successfully');
  
  const currentTheme = tokens.tokens_current();
  assert(currentTheme === 'dark', 'Current theme should be "dark"');
  
  // Reset to default
  tokens.tokens_apply('default');
});

// Test 4: Get token value returns correct
test('get_token_value_returns_correct', () => {
  tokens.tokens_apply('default');
  
  const primaryColor = tokens.tokens_get('color', 'primary');
  assert(primaryColor === '#3b82f6', 'Primary color should match default theme');
  
  const fontSize = tokens.tokens_get('font', 'sizeBase');
  assert(fontSize === '16px', 'Base font size should be 16px');
});

// Test 5: Get all returns complete tokens
test('get_all_returns_complete_tokens', () => {
  tokens.tokens_apply('default');
  
  const allTokens = tokens.tokens_get_all();
  assert(allTokens !== null, 'Should return tokens object');
  assert(allTokens.color !== undefined, 'Should have color tokens');
  assert(allTokens.font !== undefined, 'Should have font tokens');
  assert(allTokens.radius !== undefined, 'Should have radius tokens');
  assert(allTokens.motion !== undefined, 'Should have motion tokens');
});

// Test 6: List themes shows available
test('list_themes_shows_available', () => {
  const themes = tokens.tokens_list_themes();
  assert(Array.isArray(themes), 'Should return an array');
  assert(themes.length >= 2, 'Should have at least 2 themes');
  assert(themes.includes('default'), 'Should include default theme');
  assert(themes.includes('dark'), 'Should include dark theme');
});

// Test 7: To CSS vars generates valid CSS
test('to_css_vars_generates_valid_css', () => {
  tokens.tokens_apply('default');
  
  const cssVars = tokens.tokens_to_css_vars();
  assert(typeof cssVars === 'string', 'Should return a string');
  assert(cssVars.includes(':root'), 'Should include :root selector');
  assert(cssVars.includes('--color-primary'), 'Should include color variables');
  assert(cssVars.includes('--font-sizeBase'), 'Should include font variables');
  assert(cssVars.includes('#3b82f6'), 'Should include token values');
});

// Test 8: Invalid theme returns error
test('invalid_theme_returns_error', () => {
  const result = tokens.tokens_load('nonexistent');
  assert(result.success === false, 'Should fail for nonexistent theme');
  assert(result.error !== undefined, 'Should return error message');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Tests passed: ${passCount}`);
console.log(`Tests failed: ${failCount}`);
console.log('='.repeat(50));

process.exit(failCount > 0 ? 1 : 0);
