/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f0ff",
          100: "#e0e0ff",
          200: "#c2c2ff",
          300: "#a3a3ff",
          400: "#8585ff",
          500: "#1a1a2e",
          600: "#16162b",
          700: "#121228",
          800: "#0e0e25",
          900: "#0a0a22",
        },
      },
    },
  },
  plugins: [],
};
