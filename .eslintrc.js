module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  env: { node: true },
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-var-requires': 'off'
  }
};
