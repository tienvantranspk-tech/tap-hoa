import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import packageJson from "./package.json";

const appVersion = process.env.VITE_APP_VERSION || packageJson.version;
const buildTime = new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  base: "/",
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
