import type { Plugin } from 'esbuild';
import { defineConfig } from 'tsup';

/**
 * Points the `preact` specifiers at React and keeps React external. esbuild never
 * resolves a path marked external, so this build must also list `preact` in
 * `noExternal` — without that this plugin is never consulted and Preact gets
 * bundled into the output instead.
 *
 * An unmapped `preact/*` subpath fails the build rather than silently inlining
 * Preact: `noExternal` un-externalises every subpath, so anything missing here
 * would be resolved and copied into the React bundle.
 */
const preactToReact: Plugin = {
  name: 'preact-to-react',
  setup(build) {
    const targets: Record<string, string> = {
      'preact': 'react',
      'preact/hooks': 'react',
      'preact/jsx-runtime': 'react/jsx-runtime',
    };
    build.onResolve({ filter: /^preact(\/|$)/ }, (args) => {
      const path = targets[args.path];
      if (!path) {
        return {
          errors: [{
            text: `No React equivalent is mapped for "${args.path}". Add one to preactToReact, `
              + 'or Preact would be bundled into the React build.',
          }],
        };
      }
      return { external: true, path };
    });
  },
};

// The React build: the same source, with the `preact` specifiers resolved to React
// and the declarations carrying React's JSX types. Shares `dist/` with the Preact
// build, which runs first and owns cleaning.
export default defineConfig({
  clean: false,
  dts: { entry: 'src/index.ts' },
  entry: ['src/index.ts'],
  external: ['react', 'react/jsx-runtime'],
  format: ['esm'],
  minify: false,
  noExternal: [/^preact/],
  outDir: 'dist/react',
  sourcemap: true,
  target: 'es2020',
  tsconfig: 'tsconfig.react.json',
  esbuildPlugins: [preactToReact],
});
