/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        dark: {
          800: '#1e1e24',
          850: '#18181b',
          900: '#0f0f11',
          950: '#09090b',
        }
      }
    },
  },
  plugins: [],
}

