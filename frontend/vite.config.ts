import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  cacheDir: '/tmp/vite-sentryvision-cache',
  server: {
    host: "::",
    port: 5173,
    allowedHosts: [
      process.env.VITE_ALLOWED_HOST || 'localhost',
      '127.0.0.1',
      '::1',
      '.lan',
    ],
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:9753",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:9753",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/batch": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:9753",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/batch/, "/api/batch"),
      },
      "/detection": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:9753",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/detection/, "/api/detection"),
      },
      "/events": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:9753",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/events/, "/api/events"),
      },
      "/opencv": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:9753",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/opencv/, "/api/opencv"),
      },
      "/motion": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:9753",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/motion/, "/api/motion"),
      },
      "/snapshots": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:9753",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/snapshots/, "/api/snapshots"),
      },
      "/cameras": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:9753",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/cameras/, "/api/cameras"),
      },
      "/auth": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:9753",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/auth/, "/api/auth"),
      },
      "/system": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:9753",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/system/, "/api/system"),
      },
      "/analytics": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:9753",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/analytics/, "/api/analytics"),
      },
      "/alerts": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:9753",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/alerts/, "/api/alerts"),
      },
    },
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});