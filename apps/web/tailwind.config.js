const path = require('path');
const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
    path.resolve(__dirname, './src/**/*.{js,ts,jsx,tsx,mdx}'),
    path.resolve(__dirname, '../../packages/ui/src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      fontFamily: {
        // Noto Sans Malayalam sits FIRST but its @font-face is scoped to the
        // Malayalam Unicode range (see layout.tsx), so the browser only uses it
        // for Malayalam codepoints — Latin still resolves to the system stack
        // below. Putting it first (not last) is what makes it win over a system
        // UI font that produces a broken glyph instead of no glyph. Inputs and
        // textareas inherit `sans`, so this reaches the folder-name field too.
        sans: [
          'var(--font-noto-malayalam)',
          '"Noto Sans Malayalam"',
          ...defaultTheme.fontFamily.sans,
        ],
        mono: [
          'var(--font-noto-malayalam)',
          '"Noto Sans Malayalam"',
          ...defaultTheme.fontFamily.mono,
        ],
      },
      colors: {
        brand: {
          50: '#f0f3ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#1e1b4b',
        },
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
};
