import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
  test: { include: ['tests/**/*.test.ts'] },
} as Parameters<typeof defineConfig>[0]);
