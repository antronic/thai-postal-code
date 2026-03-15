import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],       // dual output: dist/index.cjs + dist/index.js
  dts: true,                    // emit .d.ts + .d.cts declaration files
  splitting: false,             // single output file per format — no dynamic import() chunks
  sourcemap: true,              // emit .map files for debugging
  clean: true,                  // wipe dist/ before each build
  minify: true,                 // minify output — meaningful savings given the bundled data array
  treeshake: true,              // remove unused exports
  outDir: "dist",
  // Bundle everything — the data file is a local TS module, not an npm dep
  noExternal: [/.*/],
  bundle: true,
  // Resolve extensionless .ts imports (e.g. "../data/thai-postal-code.data")
  esbuildOptions(options) {
    options.resolveExtensions = [".ts", ".tsx", ".js", ".jsx", ".json"];
  },
});