/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#00C853',
        accent: '#FF5252',
        'pitch-dark': '#1A3A2E',
        'pitch-mid': '#2D5A3F',
        'pitch-light': '#3B7A57',
        warning: '#F59E0B',
        error: '#EF4444',
        gold: '#FFD700',
        surface: '#FFFFFF',
        border: '#E5E7EB',
      },
      fontFamily: {
        bebas: ['BebasNeue'],
        dm: ['DMSans'],
        mono: ['JetBrainsMono'],
      },
    },
  },
};
