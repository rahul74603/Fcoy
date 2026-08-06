/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Yeh line ensure karti hai ki React files scan hon
  ],
  theme: {
    extend: {
      colors: {
        military: {
          50: '#F3F4F1',
          100: '#E5E7E1',
          200: '#C5C9BE',
          300: '#A5AB9B',
          400: '#858D78',
          500: '#646F54',
          600: '#4F563F',
          700: '#3B4A2E', // Primary Olive Green
          800: '#2D3A22',
          900: '#24301B',
          950: '#19220F', // Darkest — login page, owner panel dark forms
        },
        status: {
          success: '#198754',
          warning: '#FFC107',
          danger: '#DC3545',
        }
      }
    },
  },
  plugins: [],
}