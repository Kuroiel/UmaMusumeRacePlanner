import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.(js|jsx|ts|tsx)$/, // Adjust the regex to match your file structure
  },
  // This 'base' option is CRITICAL for GitHub Pages deployment
  base: "/UmaMusumeRacePlanner/",
});
