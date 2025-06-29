import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8082,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:9753',
        changeOrigin: true,
        secure: false
      },
      '/events': {
        target: 'http://localhost:9753',
        changeOrigin: true,
        secure: false
      },
      '/snapshots': {
        target: 'http://localhost:9753',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: 'http://localhost:9753',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
