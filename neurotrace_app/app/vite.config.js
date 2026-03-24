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
            if (
              id.includes('react') ||
              id.includes('react-dom') ||
              id.includes('framer-motion') ||
              id.includes('lucide-react') ||
              id.includes('recharts') ||
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
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
})