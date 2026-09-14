import { defineConfig } from 'vitest/config';

// JSX comes from tsconfig (`jsx: react-jsx`, `jsxImportSource: preact`), which
// Vitest's transformer reads directly — no separate transform options needed.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
