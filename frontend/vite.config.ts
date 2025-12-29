import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8082",
        changeOrigin: true,
        secure: false,
      },
      "/events": {
        target: "http://localhost:8082",
        changeOrigin: true,
        secure: false,
      },
      "/snapshots": {
        target: "http://localhost:8082",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://localhost:8082",
        changeOrigin: true,
        secure: false,
        ws: true,
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