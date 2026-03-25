import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const cacheDir = process.env.LOCALAPPDATA
  ? path.resolve(
      process.env.LOCALAPPDATA,
      "vite-cache",
      "proyecto-final-frontend",
    )
  : ".vite-cache";

export default defineConfig({
  plugins: [react()],
  cacheDir,
});
