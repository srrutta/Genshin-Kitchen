import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/images': 'http://localhost:3000',
      '/shop-images': 'http://localhost:3000',
    },
  },
  test: { include: ['tests/**/*.test.js'] },
});
