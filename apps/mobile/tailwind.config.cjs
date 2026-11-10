const tokens = require('./src/theme/tokens.json');

// Spacing keeps the Tailwind 4 px scale, which matches DESIGN.md (space.1 = 4 px … space.12 = 48 px).
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: tokens.colors,
      borderRadius: tokens.radius,
      fontSize: tokens.fontSize,
    },
  },
  plugins: [],
};
