/**
 * Blog Post Generator
 * Generates realistic blog post data with tech/business themes
 */

const { randomUUID } = require('crypto');

// Sample data pools
const TITLES = [
  'Building Scalable Microservices with Node.js',
  'The Future of Web Development in 2025',
  'Understanding React Server Components',
  'Database Optimization Techniques for High Traffic',
  'Introduction to Machine Learning for Developers',
  'Best Practices for API Design',
  'Securing Your Web Applications',
  'Performance Tuning for Modern Web Apps',
  'Cloud Architecture Patterns',
  'Containerization with Docker',
  'CI/CD Pipeline Automation',
  'TypeScript Advanced Patterns',
  'GraphQL vs REST: Making the Right Choice',
  'Serverless Architecture Explained',
  'Testing Strategies for Large Codebases',
  'State Management in Modern React',
  'Building Real-time Applications',
  'Microservices vs Monoliths',
  'Database Indexing Best Practices',
  'Web Performance Optimization Guide'
];

const AUTHORS = [
  'Sarah Chen',
  'Michael Rodriguez',
  'Emily Thompson',
  'David Kim',
  'Jennifer Martinez',
  'Robert Johnson',
  'Lisa Anderson',
  'James Wilson',
  'Maria Garcia',
  'John Davis'
];

const TAGS_POOL = [
  'javascript', 'typescript', 'react', 'node.js', 'database',
  'performance', 'security', 'cloud', 'devops', 'architecture',
  'testing', 'api', 'backend', 'frontend', 'fullstack'
];

const LOREM_PARAGRAPHS = [
  'Modern web development has evolved significantly over the past decade. The introduction of new frameworks and tools has transformed how we build applications. Developers now have access to powerful abstractions that simplify complex tasks.',
  'Performance optimization remains a critical concern for web applications. Users expect fast, responsive interfaces regardless of device or network conditions. Implementing effective caching strategies and minimizing bundle sizes are essential practices.',
  'Security should be a primary consideration in every development project. Common vulnerabilities like SQL injection and cross-site scripting can be prevented with proper validation and sanitization. Regular security audits help identify potential issues before they become problems.',
  'Cloud infrastructure has revolutionized application deployment. Services like AWS, Azure, and Google Cloud provide scalable, reliable hosting solutions. Understanding cloud architecture patterns enables teams to build resilient distributed systems.',
  'Testing is an investment in code quality and maintainability. Comprehensive test coverage catches bugs early in the development cycle. Automated testing pipelines ensure consistent quality across releases.',
  'API design impacts both developer experience and application performance. RESTful conventions provide familiar patterns, while GraphQL offers more flexibility. Choosing the right approach depends on specific use cases and requirements.',
  'State management complexity increases with application size. React provides multiple solutions including Context API, Redux, and newer options like Zustand. Selecting the appropriate tool depends on team experience and project needs.',
  'Containerization simplifies deployment and ensures consistency across environments. Docker has become the de facto standard for packaging applications. Container orchestration with Kubernetes enables sophisticated deployment strategies.'
];

/**
 * Generate a URL-friendly slug from a title
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
 * Generate a single blog post
 */
function generateBlogPost(index, seed = 0) {
  const titleIndex = (index + seed) % TITLES.length;
  const title = TITLES[titleIndex];
  const slug = slugify(title);
  
  const authorIndex = (index * 7 + seed) % AUTHORS.length;
  const author = AUTHORS[authorIndex];
  
  // Generate 2-3 paragraphs
  const paragraphCount = 2 + (index % 2);
  const paragraphs = [];
  for (let i = 0; i < paragraphCount; i++) {
    const pIndex = (index * 3 + i + seed) % LOREM_PARAGRAPHS.length;
    paragraphs.push(LOREM_PARAGRAPHS[pIndex]);
  }
  const content = paragraphs.join('\n\n');
  const excerpt = content.substring(0, 150) + '...';
  
  // Generate 2-4 tags
  const tagCount = 2 + (index % 3);
  const tags = [];
  for (let i = 0; i < tagCount; i++) {
    const tagIndex = (index * 5 + i + seed) % TAGS_POOL.length;
    tags.push(TAGS_POOL[tagIndex]);
  }
  
  // Random date within last 90 days
  const daysAgo = (index % 90);
  const publishedAt = new Date();
  publishedAt.setDate(publishedAt.getDate() - daysAgo);
  
  return {
    id: randomUUID(),
    title,
    slug,
    author,
    excerpt,
    content,
    published_at: publishedAt.toISOString(),
    tags
  };
}

module.exports = {
  generate: generateBlogPost
};
