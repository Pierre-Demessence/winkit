import antfu from '@antfu/eslint-config';

export default antfu({
  ignores: ['dist/**', 'node_modules/**', 'docs/**'],
  markdown: false,
  typescript: true,
  stylistic: {
    indent: 2,
    quotes: 'single',
    semi: true,
  },
});
