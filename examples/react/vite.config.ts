import { defineConfig } from 'vite';

// Vite reads `jsx` and `jsxImportSource` from tsconfig.json, but they are set
// again here so the example still builds if it is copied without its tsconfig.
export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  // The library is linked by symlink, so it resolves `react` from its own folder
  // (the repo root's devDependency) rather than from this one. Deduping forces a
  // single copy — without it, two React versions mix and rendering throws.
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 5182 },
});
