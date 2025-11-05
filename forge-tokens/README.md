# forge-tokens

Design token management module for Forge Flow with Ntoken schema support. Enables theme switching and visual customization through a standardized token system.

## Overview

The forge-tokens module provides a complete design token management system that allows applications to dynamically load, switch, and apply visual themes. It implements the Ntoken schema v1.0, covering color, typography, spacing, and motion design tokens.

## Features

- **Theme Management**: Load and switch between multiple themes at runtime
- **Token Access**: Programmatic access to design tokens by category and key
- **CSS Generation**: Automatic CSS custom property generation from tokens
- **Schema Validation**: Built-in validation for Ntoken schema compliance
- **Theme Discovery**: List and enumerate available themes
- **Memory Caching**: Efficient theme caching for quick switching

## Ntoken Schema Specification

The Ntoken schema defines four core token categories:

### Color Tokens
```json
{
  "primary": { "value": "#hexcode", "description": "Primary brand color" },
  "secondary": { "value": "#hexcode", "description": "Secondary accent" },
  "background": { "value": "#hexcode", "description": "Default background" },
  "surface": { "value": "#hexcode", "description": "Card/panel surface" },
  "text": { "value": "#hexcode", "description": "Primary text" },
  "textMuted": { "value": "#hexcode", "description": "Secondary text" },
  "border": { "value": "#hexcode", "description": "Border color" },
  "error": { "value": "#hexcode", "description": "Error state" },
  "success": { "value": "#hexcode", "description": "Success state" }
}
```

### Font Tokens
```json
{
  "family": { "value": "string", "description": "Font stack" },
  "sizeBase": { "value": "16px", "description": "Base font size" },
  "sizeSmall": { "value": "14px", "description": "Small text" },
  "sizeLarge": { "value": "20px", "description": "Large text" },
  "sizeHeading": { "value": "32px", "description": "Heading size" },
  "weightNormal": { "value": "400", "description": "Normal weight" },
  "weightBold": { "value": "700", "description": "Bold weight" }
}
```

### Radius Tokens
```json
{
  "none": { "value": "0px", "description": "No rounding" },
  "small": { "value": "4px", "description": "Subtle rounding" },
  "medium": { "value": "8px", "description": "Standard rounding" },
  "large": { "value": "16px", "description": "Pronounced rounding" },
  "full": { "value": "9999px", "description": "Pill shape" }
}
```

### Motion Tokens
```json
{
  "durationFast": { "value": "150ms", "description": "Quick transitions" },
  "durationNormal": { "value": "250ms", "description": "Standard transitions" },
  "durationSlow": { "value": "400ms", "description": "Slow transitions" },
  "easing": { "value": "ease-in-out", "description": "Default easing" }
}
```

## Built-in Themes

### Default Theme
Light mode theme with blue primary colors, ideal for general applications.
- **ID**: `default`
- **Primary**: #3b82f6 (Blue)
- **Background**: #ffffff (White)

### Dark Theme
Dark mode theme with brighter accent colors for improved contrast.
- **ID**: `dark`
- **Primary**: #60a5fa (Light Blue)
- **Background**: #111827 (Dark Gray)

## API Reference

### tokens_load(themeId)
Load a theme from the themes directory.

**Parameters:**
- `themeId` (string): Theme identifier (e.g., 'default', 'dark')

**Returns:**
- Object with `success` (boolean), `error` (string, if failed), and `theme` (object, if successful)

**Example:**
```javascript
const tokens = require('./forge-tokens');
const result = tokens.tokens_load('dark');

if (result.success) {
  console.log('Theme loaded:', result.theme.name);
} else {
  console.error('Error:', result.error);
}
```

### tokens_apply(themeId)
Apply a theme (sets it as current).

**Parameters:**
- `themeId` (string): Theme identifier

**Returns:**
- Object with `success` (boolean) and `error` (string, if failed)

**Example:**
```javascript
const result = tokens.tokens_apply('dark');
if (result.success) {
  console.log('Theme applied successfully');
}
```

### tokens_current()
Get the currently active theme ID.

**Returns:**
- String: Current theme identifier

**Example:**
```javascript
const currentTheme = tokens.tokens_current();
console.log('Active theme:', currentTheme); // 'default'
```

### tokens_get(category, key)
Get a specific token value.

**Parameters:**
- `category` (string): Token category ('color', 'font', 'radius', 'motion')
- `key` (string): Token key (e.g., 'primary', 'sizeBase')

**Returns:**
- String: Token value, or null if not found

**Example:**
```javascript
const primaryColor = tokens.tokens_get('color', 'primary');
console.log(primaryColor); // '#3b82f6'

const fontSize = tokens.tokens_get('font', 'sizeBase');
console.log(fontSize); // '16px'
```

### tokens_get_all()
Get all tokens for the current theme.

**Returns:**
- Object: Complete tokens object, or null if theme not loaded

**Example:**
```javascript
const allTokens = tokens.tokens_get_all();
console.log(allTokens.color.primary.value); // '#3b82f6'
console.log(allTokens.font.sizeBase.value); // '16px'
```

### tokens_list_themes()
List all available theme IDs.

**Returns:**
- Array of strings: Available theme identifiers

**Example:**
```javascript
const themes = tokens.tokens_list_themes();
console.log(themes); // ['default', 'dark']
```

### tokens_to_css_vars()
Generate CSS custom properties from the current theme.

**Returns:**
- String: CSS variables in `:root` selector format

**Example:**
```javascript
const cssVars = tokens.tokens_to_css_vars();
console.log(cssVars);
// Output:
// :root {
//   --color-primary: #3b82f6;
//   --color-secondary: #8b5cf6;
//   --font-sizeBase: 16px;
//   ...
// }
```

## Usage Examples

### Basic Theme Switching
```javascript
const tokens = require('./forge-tokens');

// Load and apply dark theme
tokens.tokens_apply('dark');

// Get current theme
console.log('Current:', tokens.tokens_current()); // 'dark'

// Switch back to default
tokens.tokens_apply('default');
```

### Accessing Token Values
```javascript
const tokens = require('./forge-tokens');

// Get individual tokens
const primaryColor = tokens.tokens_get('color', 'primary');
const borderRadius = tokens.tokens_get('radius', 'medium');
const transition = tokens.tokens_get('motion', 'durationNormal');

console.log(`Primary: ${primaryColor}`);
console.log(`Radius: ${borderRadius}`);
console.log(`Duration: ${transition}`);
```

### CSS Variable Generation
```javascript
const tokens = require('./forge-tokens');
const fs = require('fs');

// Generate CSS variables
tokens.tokens_apply('default');
const css = tokens.tokens_to_css_vars();

// Write to file
fs.writeFileSync('theme.css', css, 'utf8');
```

### Theme Enumeration
```javascript
const tokens = require('./forge-tokens');

// List available themes
const themes = tokens.tokens_list_themes();
console.log('Available themes:', themes);

// Load each theme
themes.forEach(themeId => {
  const result = tokens.tokens_load(themeId);
  if (result.success) {
    console.log(`Loaded: ${result.theme.name}`);
  }
});
```

## Integration with ForgeView

The forge-tokens module integrates seamlessly with ForgeView for live component development:

```javascript
const tokens = require('./forge-tokens');
const forgeView = require('../forge-view');

// Apply theme before rendering
tokens.tokens_apply('dark');

// Inject CSS variables into component
const cssVars = tokens.tokens_to_css_vars();
forgeView.view_inject_css(cssVars);

// Render component with applied theme
forgeView.view_render();
```

## Creating Custom Themes

To create a new theme:

1. Create a JSON file in `forge-tokens/themes/` (e.g., `ocean.json`)
2. Follow the Ntoken schema structure
3. Include all required token categories (color, font, radius, motion)
4. Provide unique `id` and `name` properties

**Example custom theme:**
```json
{
  "name": "Ocean",
  "id": "ocean",
  "version": "1.0.0",
  "tokens": {
    "color": {
      "primary": { "value": "#0891b2", "description": "Ocean blue" },
      "secondary": { "value": "#06b6d4", "description": "Cyan accent" },
      "background": { "value": "#f0fdfa", "description": "Mint background" },
      "surface": { "value": "#ccfbf1", "description": "Teal surface" },
      "text": { "value": "#134e4a", "description": "Deep teal text" },
      "textMuted": { "value": "#5eead4", "description": "Light teal" },
      "border": { "value": "#99f6e4", "description": "Teal border" },
      "error": { "value": "#dc2626", "description": "Red error" },
      "success": { "value": "#059669", "description": "Green success" }
    },
    "font": {
      "family": { "value": "system-ui, sans-serif", "description": "Sans serif" },
      "sizeBase": { "value": "16px", "description": "Base size" },
      "sizeSmall": { "value": "14px", "description": "Small size" },
      "sizeLarge": { "value": "20px", "description": "Large size" },
      "sizeHeading": { "value": "32px", "description": "Heading size" },
      "weightNormal": { "value": "400", "description": "Normal" },
      "weightBold": { "value": "700", "description": "Bold" }
    },
    "radius": {
      "none": { "value": "0px", "description": "Square" },
      "small": { "value": "4px", "description": "Subtle" },
      "medium": { "value": "8px", "description": "Standard" },
      "large": { "value": "16px", "description": "Large" },
      "full": { "value": "9999px", "description": "Pill" }
    },
    "motion": {
      "durationFast": { "value": "150ms", "description": "Fast" },
      "durationNormal": { "value": "250ms", "description": "Normal" },
      "durationSlow": { "value": "400ms", "description": "Slow" },
      "easing": { "value": "ease-in-out", "description": "Smooth" }
    }
  }
}
```

## Testing

Run the test suite to verify module functionality:

```bash
node forge-tokens/test-tokens.cjs
```

The test suite includes:
1. Load default theme
2. Load dark theme
3. Apply theme changes current
4. Get token value returns correct
5. Get all returns complete tokens
6. List themes shows available
7. To CSS vars generates valid CSS
8. Invalid theme returns error

## Future Enhancements

- **Theme Marketplace**: Online repository for community-created themes
- **Custom Token Categories**: Support for additional token types (spacing, shadows, etc.)
- **Theme Validation CLI**: Command-line tool for validating custom themes
- **Runtime Token Editing**: Dynamic token modification without file changes
- **Theme Export**: Export themes to various formats (Figma, Sketch, etc.)
- **Token Aliases**: Reference tokens from other tokens for consistency
- **Dark Mode Auto-Detection**: Automatic theme switching based on system preferences

## Related Modules

- **forge-view**: Component rendering and live reload
- **forge-cairns**: Style scope management
- **forge-build**: Production build optimization

## Module Info

- **Location**: `forge-tokens/`
- **Entry Point**: `index.cjs`
- **Dependencies**: Node.js fs, path (built-in)
- **Format**: CommonJS (CJS)
- **Version**: 1.0.0

## License

Part of the Chromasmith Forge Flow project.
