import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:9753',
        changeOrigin: true,
        secure: false,
        timeout: 10000,
      },
      '/events': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        secure: false,
        timeout: 10000,
      },
      '/snapshots': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        secure: false,
        timeout: 10000,
      },
      '/stream': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        secure: false,
        timeout: 10000,
      },
      '/snapshot': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        secure: false,
        timeout: 10000,
      },
      '/socket.io': {
        target: 'http://localhost:9753',
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 10000,
      }
    }
  },
  plugins: [
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs'],
          utils: ['date-fns', 'clsx', 'tailwind-merge'],
          charts: ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
}));
