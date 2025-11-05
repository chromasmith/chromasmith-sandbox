# Forge Stubs

Static demo data generators for rapid prototyping without external service dependencies.

## Purpose

Forge Stubs provides realistic sample data for common use cases (blogs, products, users) without requiring database provisioning, API setup, or network calls. Perfect for:

- **Component development**: Test UI with realistic data
- **Demos and presentations**: Consistent, professional-looking content
- **Integration testing**: Predictable data sets for validation
- **Prototyping**: Fast iteration without backend dependencies

## Features

- ✅ **Zero dependencies**: Pure Node.js, no external services
- ✅ **Deterministic generation**: Same seed = same data
- ✅ **Schema validation**: Guaranteed data structure
- ✅ **Rich datasets**: Blog posts, products, user profiles
- ✅ **Realistic content**: Natural-looking titles, descriptions, names

## Available Datasets

### Blog Posts
50 tech/business blog posts with authors, tags, and content.

**Schema**: `id`, `title`, `slug`, `author`, `excerpt`, `content`, `published_at`, `tags`

### Products
30 e-commerce products across multiple categories.

**Schema**: `id`, `name`, `slug`, `price`, `description`, `category`, `image_url`, `in_stock`

**Categories**: electronics, clothing, home, books

### Users
20 user profiles with avatars and bios.

**Schema**: `id`, `username`, `email`, `full_name`, `avatar_url`, `bio`, `created_at`

## API Usage

### Basic Sampling

```javascript
const stubs = require('./forge-stubs');

// Get 5 blog posts
const blogs = stubs.sample('blog', 5);

// Get 10 products
const products = stubs.sample('products', 10);

// Get 3 users
const users = stubs.sample('users', 3);
```

### List Available Datasets

```javascript
const datasets = stubs.list();
// Returns: [
//   { name: 'blog', description: '...', count: 50, schema: [...] },
//   { name: 'products', description: '...', count: 30, schema: [...] },
//   { name: 'users', description: '...', count: 20, schema: [...] }
// ]
```

### Get Full Manifest

```javascript
const manifest = stubs.get_manifest();
// Returns complete manifest with version, namespace, and all dataset definitions
```

### Deterministic Generation

Use a seed for reproducible data:

```javascript
// Same seed always produces same data
const data1 = stubs.sample('blog', 5, 42);
const data2 = stubs.sample('blog', 5, 42);
// data1 === data2 (same titles, authors, etc.)

// Different seed produces different data
const data3 = stubs.sample('blog', 5, 99);
// data3 !== data1 (different content)
```

## Integration Examples

### React Component

```javascript
import stubs from './forge-stubs';

function BlogList() {
  const posts = stubs.sample('blog', 10);
  
  return (
    <div>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>By {post.author} • {new Date(post.published_at).toLocaleDateString()}</p>
          <p>{post.excerpt}</p>
          <div>
            {post.tags.map(tag => <span key={tag}>{tag}</span>)}
          </div>
        </article>
      ))}
    </div>
  );
}
```

### API Route (Next.js)

```javascript
import stubs from '@/forge-stubs';

export default function handler(req, res) {
  const { dataset, count = 10 } = req.query;
  
  try {
    const data = stubs.sample(dataset, parseInt(count));
    res.status(200).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
```

### Testing

```javascript
import stubs from './forge-stubs';

test('renders product list', () => {
  const products = stubs.sample('products', 5);
  // Test with consistent, realistic data
  expect(products).toHaveLength(5);
  expect(products[0]).toHaveProperty('name');
  expect(products[0]).toHaveProperty('price');
});
```

## Adding New Datasets

1. **Update manifest** (`nstub.manifest.json`):
```json
{
  "datasets": {
    "mydata": {
      "description": "My custom dataset",
      "count": 25,
      "schema": ["id", "field1", "field2"]
    }
  }
}
```

2. **Create generator** (`generators/mydata.cjs`):
```javascript
const { randomUUID } = require('crypto');

function generateMyData(index, seed = 0) {
  return {
    id: randomUUID(),
    field1: `value-${index}`,
    field2: index * 10
  };
}

module.exports = { generate: generateMyData };
```

3. **Register in index.cjs**:
```javascript
const generators = {
  blog: require('./generators/blog.cjs'),
  products: require('./generators/products.cjs'),
  users: require('./generators/users.cjs'),
  mydata: require('./generators/mydata.cjs')  // Add this line
};
```

## Testing

Run the test suite:

```bash
node forge-stubs/test-stubs.cjs
```

Expected output:
```
=== Forge Stubs Test Suite ===
✓ All tests passed!
```

## Error Handling

The module validates all inputs and provides clear error messages:

```javascript
// Invalid dataset name
stubs.sample('invalid', 5);
// Error: Invalid dataset: "invalid". Available datasets: blog, products, users

// Count too low
stubs.sample('blog', 0);
// Error: Count must be at least 1, got 0

// Count exceeds maximum
stubs.sample('blog', 51);
// Error: Count 51 exceeds maximum 50 for dataset "blog"
```

## Design Principles

1. **No Network Calls**: Everything runs locally, no external dependencies
2. **Deterministic**: Same input = same output (when using seeds)
3. **Schema Compliant**: Generated data always matches declared schema
4. **Realistic**: Natural-looking content for professional demos
5. **Extensible**: Easy to add new datasets and generators

## File Structure

```
forge-stubs/
├── nstub.manifest.json       # Dataset definitions and schemas
├── index.cjs                  # Main module (sample, list, get_manifest)
├── generators/
│   ├── blog.cjs              # Blog post generator
│   ├── products.cjs          # Product generator
│   └── users.cjs             # User generator
├── test-stubs.cjs            # Test suite
└── README.md                 # This file
```

## Version

**1.0** - Initial release with blog, products, and users datasets

## License

Part of the Chromasmith Forge Flow project.
