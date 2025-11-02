/**
 * Security AST Tests
 * Verify AST schema, utilities, and validation
 */

const {
  createPolicy,
  createComparison,
  createLogical,
  createAuth,
  createField,
  createLiteral,
  validateAST,
  printAST
} = require('./security-ast-utils.cjs');

const { ComparisonOp, LogicalOp, Operation } = require('./security-ast-schema.cjs');

console.log('🧪 Testing Security AST Foundation...\n');

let passed = 0;
let failed = 0;

// Test 1: Simple auth comparison (auth.uid() = user_id)
try {
  const ast1 = createPolicy(
    'select_own_rows',
    'posts',
    Operation.SELECT,
    createComparison(
      ComparisonOp.EQUALS,
      createAuth('uid'),
      createField('user_id')
    )
  );
  
  validateAST(ast1);
  console.log('✅ Test 1: Simple auth comparison');
  console.log('   AST Structure:');
  printAST(ast1, 1);
  console.log();
  passed++;
} catch (err) {
  console.error('❌ Test 1 Failed:', err.message);
  failed++;
}

// Test 2: Logical AND (auth.uid() = user_id AND status = 'published')
try {
  const ast2 = createPolicy(
    'select_published_own',
    'posts',
    Operation.SELECT,
    createLogical(
      LogicalOp.AND,
      createComparison(
        ComparisonOp.EQUALS,
        createAuth('uid'),
        createField('user_id')
      ),
      createComparison(
        ComparisonOp.EQUALS,
        createField('status'),
        createLiteral('published')
      )
    )
  );
  
  validateAST(ast2);
  console.log('✅ Test 2: Logical AND with auth and literal');
  console.log('   AST Structure:');
  printAST(ast2, 1);
  console.log();
  passed++;
} catch (err) {
  console.error('❌ Test 2 Failed:', err.message);
  failed++;
}

// Test 3: Nested logical (auth.uid() = user_id OR (role = 'admin' AND active = true))
try {
  const ast3 = createPolicy(
    'select_complex',
    'posts',
    Operation.SELECT,
    createLogical(
      LogicalOp.OR,
      createComparison(
        ComparisonOp.EQUALS,
        createAuth('uid'),
        createField('user_id')
      ),
      createLogical(
        LogicalOp.AND,
        createComparison(
          ComparisonOp.EQUALS,
          createField('role'),
          createLiteral('admin')
        ),
        createComparison(
          ComparisonOp.EQUALS,
          createField('active'),
          createLiteral(true)
        )
      )
    )
  );
  
  validateAST(ast3);
  console.log('✅ Test 3: Nested logical conditions');
  console.log('   AST Structure:');
  printAST(ast3, 1);
  console.log();
  passed++;
} catch (err) {
  console.error('❌ Test 3 Failed:', err.message);
  failed++;
}

// Test 4: WITH CHECK clause
try {
  const ast4 = createPolicy(
    'insert_own_only',
    'posts',
    Operation.INSERT,
    createComparison(
      ComparisonOp.EQUALS,
      createAuth('uid'),
      createField('user_id')
    ),
    createComparison(  // WITH CHECK
      ComparisonOp.EQUALS,
      createAuth('uid'),
      createField('user_id')
    )
  );
  
  validateAST(ast4);
  console.log('✅ Test 4: Policy with WITH CHECK clause');
  console.log('   AST Structure:');
  printAST(ast4, 1);
  console.log();
  passed++;
} catch (err) {
  console.error('❌ Test 4 Failed:', err.message);
  failed++;
}

// Test 5: Validation catches invalid AST
try {
  const invalidAST = {
    type: 'policy',
    id: 'test'
    // Missing required fields
  };
  
  validateAST(invalidAST);
  console.error('❌ Test 5: Should have caught invalid AST');
  failed++;
} catch (err) {
  console.log('✅ Test 5: Validation correctly rejects invalid AST');
  console.log(`   Error: ${err.message}\n`);
  passed++;
}

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Tests: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (failed === 0) {
  console.log('✅ All tests passed!');
} else {
  console.error('❌ Some tests failed');
  process.exit(1);
}