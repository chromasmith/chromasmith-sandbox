/**
 * Test Suite for Forge Stubs
 * Validates all functionality of the stubs module
 */

const stubs = require('./index.cjs');

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`✗ ${message}`);
    testsFailed++;
  }
}

function assertThrows(fn, message) {
  try {
    fn();
    console.error(`✗ ${message} (should have thrown)`);
    testsFailed++;
  } catch (e) {
    console.log(`✓ ${message}`);
    testsPassed++;
  }
}

console.log('\n=== Forge Stubs Test Suite ===\n');

// Test 1: Load manifest
console.log('Test Group: Manifest Loading');
try {
  const manifest = stubs.get_manifest();
  assert(manifest !== null, 'Manifest loads successfully');
  assert(manifest.version === '1.0', 'Manifest has correct version');
  assert(manifest.namespace === 'forge-stubs-shared', 'Manifest has correct namespace');
  assert(Object.keys(manifest.datasets).length === 3, 'Manifest has 3 datasets');
} catch (e) {
  console.error(`✗ Manifest loading failed: ${e.message}`);
  testsFailed++;
}

// Test 2: List available datasets
console.log('\nTest Group: List Datasets');
try {
  const datasets = stubs.list();
  assert(Array.isArray(datasets), 'list() returns an array');
  assert(datasets.length === 3, 'list() returns 3 datasets');
  
  const datasetNames = datasets.map(d => d.name);
  assert(datasetNames.includes('blog'), 'Dataset list includes blog');
  assert(datasetNames.includes('products'), 'Dataset list includes products');
  assert(datasetNames.includes('users'), 'Dataset list includes users');
  
  const blogDataset = datasets.find(d => d.name === 'blog');
  assert(blogDataset.count === 50, 'Blog dataset has count 50');
  assert(Array.isArray(blogDataset.schema), 'Blog dataset has schema array');
} catch (e) {
  console.error(`✗ List datasets failed: ${e.message}`);
  testsFailed++;
}

// Test 3: Sample blog posts
console.log('\nTest Group: Blog Posts');
try {
  const blogs = stubs.sample('blog', 5);
  assert(Array.isArray(blogs), 'sample() returns an array');
  assert(blogs.length === 5, 'sample() returns requested count');
  
  const firstBlog = blogs[0];
  assert(firstBlog.id !== undefined, 'Blog has id field');
  assert(firstBlog.title !== undefined, 'Blog has title field');
  assert(firstBlog.slug !== undefined, 'Blog has slug field');
  assert(firstBlog.author !== undefined, 'Blog has author field');
  assert(firstBlog.excerpt !== undefined, 'Blog has excerpt field');
  assert(firstBlog.content !== undefined, 'Blog has content field');
  assert(firstBlog.published_at !== undefined, 'Blog has published_at field');
  assert(Array.isArray(firstBlog.tags), 'Blog has tags array');
  
  assert(firstBlog.slug.includes('-'), 'Slug is kebab-case');
  assert(firstBlog.excerpt.length <= 155, 'Excerpt is truncated properly');
  assert(firstBlog.tags.length >= 2 && firstBlog.tags.length <= 4, 'Tags count is 2-4');
} catch (e) {
  console.error(`✗ Blog posts failed: ${e.message}`);
  testsFailed++;
}

// Test 4: Sample products
console.log('\nTest Group: Products');
try {
  const products = stubs.sample('products', 10);
  assert(products.length === 10, 'sample() returns 10 products');
  
  const firstProduct = products[0];
  assert(firstProduct.id !== undefined, 'Product has id field');
  assert(firstProduct.name !== undefined, 'Product has name field');
  assert(firstProduct.slug !== undefined, 'Product has slug field');
  assert(typeof firstProduct.price === 'number', 'Product has numeric price');
  assert(firstProduct.price >= 9.99 && firstProduct.price <= 499.99, 'Price is in range');
  assert(firstProduct.description !== undefined, 'Product has description');
  assert(['electronics', 'clothing', 'home', 'books'].includes(firstProduct.category), 
    'Product has valid category');
  assert(firstProduct.image_url !== undefined, 'Product has image_url');
  assert(typeof firstProduct.in_stock === 'boolean', 'Product has boolean in_stock');
} catch (e) {
  console.error(`✗ Products failed: ${e.message}`);
  testsFailed++;
}

// Test 5: Sample users
console.log('\nTest Group: Users');
try {
  const users = stubs.sample('users', 3);
  assert(users.length === 3, 'sample() returns 3 users');
  
  const firstUser = users[0];
  assert(firstUser.id !== undefined, 'User has id field');
  assert(firstUser.username !== undefined, 'User has username field');
  assert(firstUser.email !== undefined, 'User has email field');
  assert(firstUser.email.includes('@example.com'), 'Email has correct domain');
  assert(firstUser.full_name !== undefined, 'User has full_name field');
  assert(firstUser.avatar_url !== undefined, 'User has avatar_url field');
  assert(firstUser.avatar_url.includes('gravatar.com'), 'Avatar uses Gravatar');
  assert(firstUser.bio !== undefined, 'User has bio field');
  assert(firstUser.created_at !== undefined, 'User has created_at field');
  
  // Validate username format (lowercase with underscores)
  assert(firstUser.username === firstUser.username.toLowerCase(), 'Username is lowercase');
  assert(/^[a-z_0-9]+$/.test(firstUser.username), 'Username has valid format');
} catch (e) {
  console.error(`✗ Users failed: ${e.message}`);
  testsFailed++;
}

// Test 6: Validate data structure
console.log('\nTest Group: Data Structure Validation');
try {
  const manifest = stubs.get_manifest();
  
  // Validate blog structure matches schema
  const blogSample = stubs.sample('blog', 1)[0];
  const blogSchema = manifest.datasets.blog.schema;
  const blogKeys = Object.keys(blogSample);
  
  assert(blogKeys.length === blogSchema.length, 'Blog has all schema fields');
  blogSchema.forEach(field => {
    assert(blogKeys.includes(field), `Blog has field: ${field}`);
  });
  
  // Validate products structure
  const productSample = stubs.sample('products', 1)[0];
  const productSchema = manifest.datasets.products.schema;
  const productKeys = Object.keys(productSample);
  
  assert(productKeys.length === productSchema.length, 'Product has all schema fields');
  productSchema.forEach(field => {
    assert(productKeys.includes(field), `Product has field: ${field}`);
  });
} catch (e) {
  console.error(`✗ Data structure validation failed: ${e.message}`);
  testsFailed++;
}

// Test 7: Handle invalid dataset name
console.log('\nTest Group: Error Handling');
assertThrows(
  () => stubs.sample('invalid_dataset', 5),
  'Throws error for invalid dataset name'
);

// Test 8: Handle count bounds
assertThrows(
  () => stubs.sample('blog', 0),
  'Throws error for count < 1'
);

assertThrows(
  () => stubs.sample('blog', 51),
  'Throws error for count > max (50 for blog)'
);

assertThrows(
  () => stubs.sample('products', 31),
  'Throws error for count > max (30 for products)'
);

// Test 9: Deterministic generation with seed
console.log('\nTest Group: Deterministic Generation');
try {
  const sample1 = stubs.sample('blog', 3, 42);
  const sample2 = stubs.sample('blog', 3, 42);
  
  assert(sample1[0].title === sample2[0].title, 'Same seed produces same titles');
  assert(sample1[0].author === sample2[0].author, 'Same seed produces same authors');
  
  const sample3 = stubs.sample('blog', 3, 99);
  assert(sample1[0].title !== sample3[0].title || sample1[0].author !== sample3[0].author,
    'Different seed produces different data');
} catch (e) {
  console.error(`✗ Deterministic generation failed: ${e.message}`);
  testsFailed++;
}

// Final results
console.log('\n=== Test Results ===');
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log(`Total:  ${testsPassed + testsFailed}\n`);

if (testsFailed === 0) {
  console.log('✓ All tests passed!');
  process.exit(0);
} else {
  console.error(`✗ ${testsFailed} test(s) failed`);
  process.exit(1);
}
