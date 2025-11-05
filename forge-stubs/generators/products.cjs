/**
 * Product Generator
 * Generates e-commerce product catalog data
 */

const { randomUUID } = require('crypto');

// Product name pools by category
const PRODUCTS = {
  electronics: [
    'Wireless Bluetooth Headphones',
    'Smart Watch Pro',
    'Portable Power Bank',
    'USB-C Fast Charger',
    '4K Webcam',
    'Mechanical Keyboard',
    'Wireless Gaming Mouse',
    'External SSD Drive'
  ],
  clothing: [
    'Premium Cotton T-Shirt',
    'Classic Denim Jeans',
    'Merino Wool Sweater',
    'Waterproof Rain Jacket',
    'Athletic Running Shorts',
    'Casual Button-Down Shirt',
    'Comfort Fit Hoodie',
    'Performance Leggings'
  ],
  home: [
    'Stainless Steel Coffee Maker',
    'Memory Foam Pillow',
    'LED Desk Lamp',
    'Ceramic Dinner Plate Set',
    'Non-Stick Cookware Set',
    'Bamboo Cutting Board',
    'Electric Kettle',
    'Throw Blanket'
  ],
  books: [
    'The Art of Software Design',
    'Modern JavaScript Guide',
    'Cloud Architecture Handbook',
    'Data Structures Explained',
    'Leadership Principles',
    'Product Management Essentials',
    'UX Design Fundamentals',
    'Startup Growth Strategies'
  ]
};

const CATEGORIES = ['electronics', 'clothing', 'home', 'books'];

const DESCRIPTIONS = {
  electronics: [
    'High-quality audio with premium sound drivers and noise cancellation.',
    'Advanced features with long battery life and water resistance.',
    'Compact design with powerful performance and fast charging.',
    'Professional-grade quality with durable construction.'
  ],
  clothing: [
    'Comfortable fit with breathable fabric and modern styling.',
    'Premium materials with attention to detail and craftsmanship.',
    'Versatile design suitable for casual or formal occasions.',
    'Durable construction with classic styling that never goes out of fashion.'
  ],
  home: [
    'Essential kitchen tool with reliable performance and easy cleaning.',
    'Stylish design that complements any home decor.',
    'Practical solution with efficient operation and quality materials.',
    'Long-lasting durability with elegant aesthetics.'
  ],
  books: [
    'Comprehensive guide with practical examples and expert insights.',
    'Essential reading for professionals seeking to advance their knowledge.',
    'In-depth exploration of key concepts with real-world applications.',
    'Proven strategies backed by research and industry experience.'
  ]
};

/**
 * Generate a URL-friendly slug from product name
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

/**
 * Generate a price between $9.99 and $499.99
 */
function generatePrice(index, seed = 0) {
  const base = 9.99;
  const range = 490;
  const value = base + ((index * 37 + seed) % range);
  return Math.round(value * 100) / 100;
}

/**
 * Generate a single product
 */
function generateProduct(index, seed = 0) {
  // Select category
  const categoryIndex = (index + seed) % CATEGORIES.length;
  const category = CATEGORIES[categoryIndex];
  
  // Select product name from category
  const productPool = PRODUCTS[category];
  const nameIndex = (index * 3 + seed) % productPool.length;
  const name = productPool[nameIndex];
  const slug = slugify(name);
  
  // Select description
  const descPool = DESCRIPTIONS[category];
  const descIndex = (index * 5 + seed) % descPool.length;
  const description = descPool[descIndex];
  
  const price = generatePrice(index, seed);
  
  // In stock based on index (80% in stock)
  const inStock = (index % 5) !== 0;
  
  // Placeholder image URL
  const imageUrl = `https://via.placeholder.com/400x300?text=${encodeURIComponent(name)}`;
  
  return {
    id: randomUUID(),
    name,
    slug,
    price,
    description,
    category,
    image_url: imageUrl,
    in_stock: inStock
  };
}

module.exports = {
  generate: generateProduct
};
