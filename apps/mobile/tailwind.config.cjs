module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: { colors: { paper: '#F7F6F1', ink: '#111827', brand: '#2E5BFF', lime: '#D8FF3B' } } },
  plugins: [],
};
