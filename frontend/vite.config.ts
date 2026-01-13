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
      "/events": {
        target: process.env.VITE_BACKEND_URL || "http://backend:8082",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/events/, "/api/events"),
      },
      "/opencv": {
        target: process.env.VITE_BACKEND_URL || "http://backend:8082",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/opencv/, "/api/opencv"),
      },
      "/motion": {
        target: process.env.VITE_BACKEND_URL || "http://backend:8082",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/motion/, "/api/motion"),
      },
      "/snapshots": {
        target: process.env.VITE_BACKEND_URL || "http://backend:8082",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/snapshots/, "/api/snapshots"),
      },
      "/cameras": {
        target: process.env.VITE_BACKEND_URL || "http://backend:8082",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/cameras/, "/api/cameras"),
      },
      "/auth": {
        target: process.env.VITE_BACKEND_URL || "http://backend:8082",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/auth/, "/api/auth"),
      },
      "/system": {
        target: process.env.VITE_BACKEND_URL || "http://backend:8082",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/system/, "/api/system"),
      },
      "/analytics": {
        target: process.env.VITE_BACKEND_URL || "http://backend:8082",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/analytics/, "/api/analytics"),
      },
      "/alerts": {
        target: process.env.VITE_BACKEND_URL || "http://backend:8082",
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
      "@": path.resolve(__dirname, "./src"),
    },
  },
});