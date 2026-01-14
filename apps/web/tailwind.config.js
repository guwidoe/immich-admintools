/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        immich: {
          primary: '#4250af',
          dark: {
            bg: '#121212',
            card: '#1e1e1e',
            border: '#2e2e2e',
            text: '#e0e0e0',
            muted: '#a0a0a0'
          }
        }
      }
    }
  },
  plugins: []
};
