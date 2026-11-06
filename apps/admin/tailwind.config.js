/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          500: "#1a1a2e",
          600: "#16162b",
        },
      },
    },
  },
  plugins: [],
};