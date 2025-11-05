/**
 * User Generator
 * Generates user profile data
 */

const { randomUUID } = require('crypto');
const crypto = require('crypto');

// Name pools
const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey',
  'Riley', 'Cameron', 'Quinn', 'Jamie', 'Avery',
  'Drew', 'Sam', 'Blake', 'Reese', 'Sage',
  'Charlie', 'River', 'Skylar', 'Finley', 'Parker'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones',
  'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'
];

const BIO_TEMPLATES = [
  'Software developer passionate about building great products.',
  'Designer focused on creating intuitive user experiences.',
  'Product manager with experience in startups and enterprise.',
  'Full-stack engineer who loves solving complex problems.',
  'Creative developer bridging design and engineering.',
  'Tech enthusiast exploring new frameworks and tools.',
  'Building the future of web applications.',
  'Advocate for clean code and solid architecture.',
  'Always learning, always shipping.',
  'Maker, builder, and problem solver.'
];

/**
 * Generate a username from first and last name
 */
function generateUsername(firstName, lastName, index) {
  const base = `${firstName}_${lastName}`.toLowerCase();
  return index % 3 === 0 ? base : `${base}${index % 100}`;
}

/**
 * Generate a Gravatar URL for an email
 */
function generateGravatarUrl(email) {
  const hash = crypto
    .createHash('md5')
    .update(email.toLowerCase().trim())
    .digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=200`;
}

/**
 * Generate a single user profile
 */
function generateUser(index, seed = 0) {
  // Select names
  const firstIndex = (index * 3 + seed) % FIRST_NAMES.length;
  const lastIndex = (index * 7 + seed) % LAST_NAMES.length;
  const firstName = FIRST_NAMES[firstIndex];
  const lastName = LAST_NAMES[lastIndex];
  
  const fullName = `${firstName} ${lastName}`;
  const username = generateUsername(firstName, lastName, index);
  const email = `${username}@example.com`;
  
  // Select bio
  const bioIndex = (index * 5 + seed) % BIO_TEMPLATES.length;
  const bio = BIO_TEMPLATES[bioIndex];
  
  // Generate avatar URL
  const avatarUrl = generateGravatarUrl(email);
  
  // Random created date within last year
  const daysAgo = (index % 365);
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - daysAgo);
  
  return {
    id: randomUUID(),
    username,
    email,
    full_name: fullName,
    avatar_url: avatarUrl,
    bio,
    created_at: createdAt.toISOString()
  };
}

module.exports = {
  generate: generateUser
};
