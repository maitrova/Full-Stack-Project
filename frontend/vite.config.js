import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: [
      'narifighter.online',
      'localhost',
      '.narifighter.online'
    ]
  },
  define: {
    // Use placeholders for environment variables that will be replaced at runtime
    'process.env.VITE_API_URL': process.env.NODE_ENV === 'production' 
      ? '"VITE_API_URL_PLACEHOLDER"'
      : `"${process.env.VITE_API_URL || 'http://localhost:5000'}"`
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          redux: ['@reduxjs/toolkit', 'react-redux', 'redux-persist']
        }
      }
    }
  }
})
