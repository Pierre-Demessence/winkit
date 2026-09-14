import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/index.ts'],
  // The stylesheet is a separate artifact the host imports explicitly, so the
  // JS output stays side-effect free and tree-shakeable.
  external: ['preact', 'preact/hooks'],
  format: ['esm'],
  minify: false,
  onSuccess: 'node scripts/copy-css.mjs',
  outDir: 'dist',
  sourcemap: true,
  target: 'es2020',
});
