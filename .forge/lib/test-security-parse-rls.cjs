/**
 * RLS Parser Tests
 * Verify RLS SQL → AST conversion
 */

const { parseRLS, parseRLSFile } = require('./security-parse-rls.cjs');
const { validateAST, printAST } = require('./security-ast-utils.cjs');

console.log('🧪 Testing RLS → AST Parser...\n');

let passed = 0;
let failed = 0;

// Test 1: Simple auth comparison
try {
  const sql1 = `
    CREATE POLICY "select_own" ON posts
      FOR SELECT
      USING (auth.uid() = user_id);
  `;
  
  const ast1 = parseRLS(sql1);
  validateAST(ast1);
  
  if (ast1.id === 'select_own' &&
      ast1.table === 'posts' &&
      ast1.operation === 'SELECT' &&
      ast1.using.type === 'comparison' &&
      ast1.using.operator === '=' &&
      ast1.using.left.type === 'auth' &&
      ast1.using.left.auth_field === 'uid' &&
      ast1.using.right.type === 'field' &&
      ast1.using.right.field === 'user_id') {
    console.log('✅ Test 1: Simple auth comparison');
    console.log('   Policy:', ast1.id);
    console.log('   AST Structure:');
    printAST(ast1, 1);
    console.log();
    passed++;
  } else {
    throw new Error('AST structure incorrect');
  }
} catch (err) {
  console.error('❌ Test 1 Failed:', err.message);
  failed++;
}

// Test 2: Logical AND with literal
try {
  const sql2 = `
    CREATE POLICY "select_published_own" ON posts
      FOR SELECT
      USING (auth.uid() = user_id AND status = 'published');
  `;
  
  const ast2 = parseRLS(sql2);
  validateAST(ast2);
  
  if (ast2.using.type === 'logical' &&
      ast2.using.operator === 'AND' &&
      ast2.using.right.type === 'comparison' &&
      ast2.using.right.right.type === 'literal' &&
      ast2.using.right.right.value === 'published') {
    console.log('✅ Test 2: Logical AND with string literal');
    console.log('   Policy:', ast2.id);
    console.log('   AST Structure:');
    printAST(ast2, 1);
    console.log();
    passed++;
  } else {
    throw new Error('AST structure incorrect');
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
  
  const ast3 = parseRLS(sql3);
  validateAST(ast3);
  
  if (ast3.using.type === 'logical' &&
      ast3.using.operator === 'OR' &&
      ast3.using.right.type === 'logical' &&
      ast3.using.right.operator === 'AND') {
    console.log('✅ Test 3: Nested logical (OR containing AND)');
    console.log('   Policy:', ast3.id);
    console.log('   AST Structure:');
    printAST(ast3, 1);
    console.log();
    passed++;
  } else {
    throw new Error('AST structure incorrect');
  }
} catch (err) {
  console.error('❌ Test 3 Failed:', err.message);
  failed++;
}

// Test 4: WITH CHECK clause
try {
  const sql4 = `
    CREATE POLICY "insert_own" ON posts
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  `;
  
  const ast4 = parseRLS(sql4);
  validateAST(ast4);
  
  if (ast4.operation === 'INSERT' &&
      ast4.withCheck &&
      ast4.withCheck.type === 'comparison') {
    console.log('✅ Test 4: INSERT policy with WITH CHECK clause');
    console.log('   Policy:', ast4.id);
    console.log('   AST Structure:');
    printAST(ast4, 1);
    console.log();
    passed++;
  } else {
    throw new Error('AST structure incorrect');
  }
} catch (err) {
  console.error('❌ Test 4 Failed:', err.message);
  failed++;
}

// Test 5: Multiple policies from file
try {
  const sqlFile = `
    CREATE POLICY "select_own" ON posts
      FOR SELECT
      USING (auth.uid() = user_id);
    
    CREATE POLICY "insert_own" ON posts
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "update_own" ON posts
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  `;
  
  const policies = parseRLSFile(sqlFile);
  
  if (policies.length === 3 &&
      policies[0].operation === 'SELECT' &&
      policies[1].operation === 'INSERT' &&
      policies[2].operation === 'UPDATE' &&
      policies[2].withCheck) {
    console.log('✅ Test 5: Parse multiple policies from file');
    console.log(`   Parsed ${policies.length} policies:`);
    policies.forEach(p => console.log(`   - ${p.id} (${p.operation})`));
    console.log();
    passed++;
  } else {
    throw new Error('File parsing incorrect');
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
  console.log('✅ All RLS parser tests passed!');
} else {
  console.error('❌ Some tests failed');
  process.exit(1);
}