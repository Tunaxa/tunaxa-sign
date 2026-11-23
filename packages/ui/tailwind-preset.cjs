/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Original AXA Sign navy brand palette (inverted scale — 500 is darkest primary)
        brand: {
          50:  '#f0f0ff',
          100: '#e0e0ff',
          200: '#c2c2ff',
          300: '#a3a3ff',
          400: '#8585ff',
          500: '#1a1a2e', // ★ PRIMARY — dark navy (sidebar, buttons)
          600: '#16162b', // ★ HOVER STATE
          700: '#121228', // deep navy (admin cards)
          800: '#0e0e25',
          900: '#0a0a22', // admin portal background
          950: '#06061a',
        },
        // Named surface colors for admin dark theme
        navy: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c2d1ff',
          300: '#9ab0ff',
          400: '#6b87ff',
          500: '#1a1a2e',
          600: '#16162b',
          700: '#121228',
          800: '#0e0e25',
          900: '#0a0a22',
        },
        surface: {
          light: '#ffffff',
          subtle: '#f8fafc',
          muted: '#f1f5f9',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        signature: ['"Dancing Script"', '"Segoe Script"', '"Brush Script MT"', '"Lucida Handwriting"', 'cursive'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08)',
        dropdown: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
        modal: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'spin-slow': 'spin 1.5s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { opacity: '0', transform: 'translateY(-4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
};
