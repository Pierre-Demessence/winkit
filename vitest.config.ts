import { defineConfig } from 'vitest/config';

// JSX comes from tsconfig (`jsx: react-jsx`, `jsxImportSource: preact`), which
// Vitest's transformer reads directly — no separate transform options needed.
//
// The React project re-points the `preact` specifiers at React, mirroring the
// alias in `tsup.config.ts`, so that suite exercises the same source under React.
const reactAlias = [
  { find: 'preact/jsx-runtime', replacement: 'react/jsx-runtime' },
  { find: 'preact/hooks', replacement: 'react' },
  { find: 'preact', replacement: 'react' },
];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          environment: 'jsdom',
          exclude: ['tests/react/**'],
          include: ['tests/**/*.test.{ts,tsx}'],
          name: 'preact',
        },
      },
      {
        resolve: { alias: reactAlias },
        test: {
          environment: 'jsdom',
          include: ['tests/react/**/*.test.tsx'],
          name: 'react',
        },
      },
    ],
  },
});
