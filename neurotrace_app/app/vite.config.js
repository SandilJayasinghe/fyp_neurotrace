import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) {
              return 'recharts';
            }
            if (id.includes('framer-motion')) {
              return 'framer-motion';
            }
            if (id.includes('lucide-react')) {
              return 'lucide';
            }
            if (
              id.includes('react') ||
              id.includes('react-dom') ||
              id.includes('axios')
            ) {
              return 'vendor';
            }

            if (
              id.includes('@radix-ui/react-progress') ||
              id.includes('@radix-ui/react-tooltip')
            ) {
              return 'radix';
            }

            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    minify: true,
  }
})