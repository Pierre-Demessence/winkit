import antfu from '@antfu/eslint-config';

export default antfu({
  // `examples/` are standalone apps with their own tsconfigs and JSX runtimes;
  // linting them from the root config would apply the wrong one.
  ignores: ['dist/**', 'examples/**', 'node_modules/**', 'docs/**'],
  markdown: false,
  typescript: true,
  stylistic: {
    indent: 2,
    quotes: 'single',
    semi: true,
  },
});
