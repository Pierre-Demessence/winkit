import { defineConfig } from 'vite';

// Vite reads `jsx` and `jsxImportSource` from tsconfig.json, but they are set
// again here so the example still builds if it is copied without its tsconfig.
export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  // The library is linked by symlink, so it resolves `preact` from its own folder
  // (the repo root's devDependency) rather than from this one. Deduping forces a
  // single copy — a split copy would break context and hooks.
  resolve: { dedupe: ['preact'] },
  server: { port: 5181 },
});
