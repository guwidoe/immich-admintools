import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  resolve: {
    conditions: ['svelte', 'browser', 'import', 'default']
  },
  optimizeDeps: {
    include: ['highlight.js', 'highlight.js/lib/core']
  },
  ssr: {
    noExternal: ['@immich/ui'],
    external: ['highlight.js']
  }
});
