import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const repoRoot = resolve(__dirname, '..', '..');
  const env = loadEnv(mode, repoRoot, '');
  const serverPort = env.PORT || '3001';

  return {
    plugins: [tailwindcss(), sveltekit()],
    server: {
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      conditions: ['svelte', 'browser', 'import', 'default'],
    },
    optimizeDeps: {
      include: ['highlight.js', 'highlight.js/lib/core'],
    },
    ssr: {
      noExternal: ['@immich/ui'],
      external: ['highlight.js'],
    },
  };
});
