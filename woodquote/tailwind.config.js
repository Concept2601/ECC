/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#fbf6f0', 100: '#f3e6d4', 200: '#e6cba8', 300: '#d6aa74', 400: '#c48a4b', 500: '#a96f33', 600: '#8a5a2b', 700: '#6c4524', 800: '#4f3320', 900: '#36241a' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
