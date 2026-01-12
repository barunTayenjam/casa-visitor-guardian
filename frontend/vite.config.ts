import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_URL || "http://backend:8082",
        changeOrigin: true,
        secure: false,
      },
      "/events": {
        target: process.env.VITE_BACKEND_URL || "http://backend:8082",
        changeOrigin: true,
        secure: false,
      },
      "/snapshots": {
        target: process.env.VITE_BACKEND_URL || "http://backend:8082",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: process.env.VITE_BACKEND_URL || "http://backend:8082",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/batch": {
        target: process.env.VITE_BACKEND_URL || "http://backend:8082",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/batch/, "/api/batch"),
      },
      "/detection": {
        target: process.env.VITE_BACKEND_URL || "http://backend:8082",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/detection/, "/api/detection"),
      },
    },
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});