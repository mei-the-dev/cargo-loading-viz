import { defineConfig } from "vite";

// Relative base so the built demo works under any GitHub Pages sub-path.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
});
