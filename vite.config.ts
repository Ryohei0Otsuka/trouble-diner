import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/trouble-diner/api": {
        target: "http://localhost",
        changeOrigin: true,
      },
    },
  },
});
