import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  // Declarations come from the JS entry alone; the stylesheet entry has no types
  // and would otherwise emit an empty `winkit.d.ts`.
  dts: { entry: 'src/index.ts' },
  // The stylesheet is a separate artifact the host imports explicitly, so the JS
  // output stays side-effect free and tree-shakeable. It is a second entry rather
  // than an import from the JS entry, and the copy loader keeps it a verbatim copy.
  entry: ['src/index.ts', 'src/winkit.css'],
  external: ['preact', 'preact/hooks'],
  format: ['esm'],
  loader: { '.css': 'copy' },
  minify: false,
  outDir: 'dist',
  sourcemap: true,
  target: 'es2020',
});
