/**
 * MySQL Generator Tests
 * Verify AST → MySQL views conversion
 */

const { generateMySQLViews } = require('./security-gen-mysql.cjs');
const { parseRLS } = require('./security-parse-rls.cjs');

console.log('🧪 Testing MySQL Views Generator...\n');

let passed = 0;
let failed = 0;

// Test 1: Simple auth comparison
try {
  const sql1 = `
    CREATE POLICY "select_own" ON posts
      FOR SELECT
      USING (auth.uid() = user_id);
  `;
  
  const ast = parseRLS(sql1);
  const views = generateMySQLViews(ast);
  
  // Verify views contain expected elements
  if (views.includes('CREATE OR REPLACE VIEW posts_secure') &&
      views.includes('@current_user_id = user_id')) {
    console.log('✅ Test 1: Simple auth comparison');
    console.log('Generated views:');
    console.log(views);
    console.log();
    passed++;
  } else {
    throw new Error('Views missing expected content');
  }
} catch (err) {
  console.error('❌ Test 1 Failed:', err.message);
  failed++;
}

// Test 2: Logical AND
try {
  const sql2 = `
    CREATE POLICY "select_published_own" ON posts
      FOR SELECT
      USING (auth.uid() = user_id AND status = 'published');
  `;
  
  const ast = parseRLS(sql2);
  const views = generateMySQLViews(ast);
  
  if (views.includes('@current_user_id = user_id') &&
      views.includes('AND') &&
      views.includes("status = 'published'")) {
    console.log('✅ Test 2: Logical AND with literal');
    console.log('Generated views:');
    console.log(views);
    console.log();
    passed++;
  } else {
    throw new Error('Views missing expected AND condition');
  }
} catch (err) {
  console.error('❌ Test 2 Failed:', err.message);
  failed++;
}

// Test 3: Nested logical (OR containing AND)
try {
  const sql3 = `
    CREATE POLICY "select_complex" ON posts
      FOR SELECT
      USING (auth.uid() = user_id OR (role = 'admin' AND active = true));
  `;
  
  const ast = parseRLS(sql3);
  const views = generateMySQLViews(ast);
  
  if (views.includes('OR') && views.includes('AND')) {
    console.log('✅ Test 3: Nested logical (OR containing AND)');
    console.log('Generated views:');
    console.log(views);
    console.log();
    passed++;
  } else {
    throw new Error('Views missing nested logical operators');
  }
} catch (err) {
  console.error('❌ Test 3 Failed:', err.message);
  failed++;
}

// Test 4: INSERT operation generates procedure
try {
  const sql4 = `
    CREATE POLICY "insert_own" ON posts
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  `;
  
  const ast = parseRLS(sql4);
  const views = generateMySQLViews(ast);
  
  if (views.includes('CREATE OR REPLACE PROCEDURE posts_insert_secure') &&
      views.includes('DELIMITER')) {
    console.log('✅ Test 4: INSERT generates stored procedure');
    console.log('Generated procedures:');
    console.log(views);
    console.log();
    passed++;
  } else {
    throw new Error('Missing stored procedure for INSERT');
  }
} catch (err) {
  console.error('❌ Test 4 Failed:', err.message);
  failed++;
}

// Test 5: Multiple operations
try {
  const policies = [
    parseRLS("CREATE POLICY p1 ON posts FOR SELECT USING (auth.uid() = user_id);"),
    parseRLS("CREATE POLICY p2 ON posts FOR UPDATE USING (auth.uid() = user_id);")
  ];
  
  const views = generateMySQLViews(policies);
  
  if (views.includes('posts_secure') &&
      views.includes('posts_update_secure')) {
    console.log('✅ Test 5: Multiple operations generate view + procedure');
    console.log('Generated SQL:');
    console.log(views);
    console.log();
    passed++;
  } else {
    throw new Error('Missing multiple operation handlers');
  }
} catch (err) {
  console.error('❌ Test 5 Failed:', err.message);
  failed++;
}

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Tests: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (failed === 0) {
  console.log('✅ All MySQL generator tests passed!');
} else {
  console.error('❌ Some tests failed');
  process.exit(1);
}
