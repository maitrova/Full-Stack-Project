import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_TINY_API_KEY': JSON.stringify(
        env.VITE_TINY_API_KEY || env.TINY_API_KEY || ''
      ),
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: ['maitrova.in', 'localhost', '.maitrova.in'],
    },
  };
});
