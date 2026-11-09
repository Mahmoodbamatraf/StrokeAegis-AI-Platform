import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// The FastAPI backend (uvicorn, port 8000) serves `frontend/dist` in production.
// During `npm run dev`, /api is proxied to it so auth, SSE and uploads stay same-origin.
const BACKEND = process.env.STROKEAEGIS_API || 'http://127.0.0.1:8000';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      // `/assets` on the backend is the repo-root assets folder, so bundles go to /static
      assetsDir: 'static',
    },
    server: {
      port: 3000,
      proxy: {
        '/api': { target: BACKEND, changeOrigin: true },
        '/assets': { target: BACKEND, changeOrigin: true },
      },
    },
  };
});
