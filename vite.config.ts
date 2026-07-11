import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Two build modes:
//  - default: full PWA into dist/web (served by the Worker via Workers Assets)
//  - demo:    single-page build into dist/demo with __DEMO__=true; the API layer
//             is swapped for an in-browser mock so it runs 100% standalone
//             (then scripts/build-demo.mjs inlines everything into one file).
export default defineConfig(({ mode }) => {
  const demo = mode === 'demo';
  return {
    root: 'web',
    publicDir: 'public',
    plugins: [react()],
    define: {
      __DEMO__: JSON.stringify(demo),
    },
    build: {
      outDir: demo ? '../dist/demo' : '../dist/web',
      emptyOutDir: true,
      target: 'es2019',
      cssTarget: 'chrome61',
      modulePreload: { polyfill: false },
      rollupOptions: {
        input: demo
          ? { main: resolve(__dirname, 'web/index.html') }
          : {
              main: resolve(__dirname, 'web/index.html'),
              admin: resolve(__dirname, 'web/admin.html'),
            },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://127.0.0.1:8787',
      },
    },
  };
});
