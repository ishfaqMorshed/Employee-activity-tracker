/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#FFFFFF',
        surface: '#F8FAFC',
        'dm-purple': { DEFAULT: '#A855F7', light: '#C084FC', dark: '#7E22CE' },
        'dm-orange': { DEFAULT: '#F97316', light: '#FB923C', dark: '#EA580C' },
        'dm-cyan':   { DEFAULT: '#06B6D4', light: '#22D3EE', dark: '#0891B2' },
      },
      fontFamily: {
        sans: ["'Greater Neue'", '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'sans-serif'],
      },
      boxShadow: {
        'glow-purple':    '0 0 20px rgba(168, 85, 247, 0.4)',
        'glow-purple-md': '0 8px 20px rgba(168, 85, 247, 0.4)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    }
  },
  plugins: []
}
