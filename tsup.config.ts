import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "react/index": "src/react/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  // The core bundle is framework-agnostic; React lives only in the /react entry.
  external: ["react", "react-dom", "react/jsx-runtime"],
  // UMD-friendly global for <script> users of the core build.
  globalName: "CargoLoadingViz",
});
