/**
 * forge-tokens/index.cjs
 * Design token management with Ntoken schema support
 * Provides theme loading, switching, and CSS variable generation
 */

const fs = require('fs');
const path = require('path');

// State
let currentTheme = 'default';
const loadedThemes = new Map();

/**
 * Load a theme from the themes directory
 * @param {string} themeId - Theme identifier (e.g., 'default', 'dark')
 * @returns {{success: boolean, error?: string, theme?: object}}
 */
function tokens_load(themeId) {
  try {
    if (loadedThemes.has(themeId)) {
      return { success: true, theme: loadedThemes.get(themeId) };
    }

    const themePath = path.join(__dirname, 'themes', `${themeId}.json`);
    
    if (!fs.existsSync(themePath)) {
      return { success: false, error: `Theme '${themeId}' not found` };
    }

    const themeData = fs.readFileSync(themePath, 'utf8');
    const theme = JSON.parse(themeData);

    // Basic schema validation
    if (!theme.id || !theme.name || !theme.tokens) {
      return { success: false, error: 'Invalid theme schema' };
    }

    const requiredCategories = ['color', 'font', 'radius', 'motion'];
    for (const category of requiredCategories) {
      if (!theme.tokens[category]) {
        return { success: false, error: `Missing required category: ${category}` };
      }
    }

    loadedThemes.set(themeId, theme);
    return { success: true, theme };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Apply a theme (sets as current)
 * @param {string} themeId - Theme identifier
 * @returns {{success: boolean, error?: string}}
 */
function tokens_apply(themeId) {
  const loadResult = tokens_load(themeId);
  
  if (!loadResult.success) {
    return loadResult;
  }

  currentTheme = themeId;
  return { success: true };
}

/**
 * Get current theme ID
 * @returns {string}
 */
function tokens_current() {
  return currentTheme;
}

/**
 * Get a specific token value
 * @param {string} category - Token category (e.g., 'color', 'font')
 * @param {string} key - Token key (e.g., 'primary', 'sizeBase')
 * @returns {string|null} Token value or null if not found
 */
function tokens_get(category, key) {
  const theme = loadedThemes.get(currentTheme);
  
  if (!theme || !theme.tokens[category] || !theme.tokens[category][key]) {
    return null;
  }

  return theme.tokens[category][key].value;
}

/**
 * Get all tokens for current theme
 * @returns {object|null} All tokens or null if theme not loaded
 */
function tokens_get_all() {
  const theme = loadedThemes.get(currentTheme);
  return theme ? theme.tokens : null;
}

/**
 * List all available theme IDs
 * @returns {string[]} Array of theme IDs
 */
function tokens_list_themes() {
  try {
    const themesDir = path.join(__dirname, 'themes');
    
    if (!fs.existsSync(themesDir)) {
      return [];
    }

    const files = fs.readdirSync(themesDir);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  } catch (error) {
    return [];
  }
}

/**
 * Generate CSS custom properties from current theme
 * @returns {string} CSS variables string
 */
function tokens_to_css_vars() {
  const tokens = tokens_get_all();
  
  if (!tokens) {
    return '';
  }

  const cssVars = [];

  // Process each category
  for (const [category, categoryTokens] of Object.entries(tokens)) {
    for (const [key, token] of Object.entries(categoryTokens)) {
      const varName = `--${category}-${key}`;
      cssVars.push(`  ${varName}: ${token.value};`);
    }
  }

  return `:root {\n${cssVars.join('\n')}\n}`;
}

// Initialize with default theme on module load
tokens_load('default');
tokens_apply('default');

module.exports = {
  tokens_load,
  tokens_apply,
  tokens_current,
  tokens_get,
  tokens_get_all,
  tokens_list_themes,
  tokens_to_css_vars
};
