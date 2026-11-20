/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // neutrals come from CSS variables so the whole app can switch to dark mode in one place
        stone: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((k) => [k, `rgb(var(--stone-${k}) / <alpha-value>)`])),
        brand: { 50: '#eef6fc', 100: '#d7e8f7', 200: '#aecfee', 300: '#7fb4e3', 400: '#4a9ee4', 500: '#0a5c9c', 600: '#004577', 700: '#00385f', 800: '#002b4a', 900: '#001e34' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
