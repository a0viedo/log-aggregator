module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    'no-console': 2,
    'no-unused-vars': [0],
    '@typescript-eslint/no-unused-vars': [0],
    'semi': ['error', 'always'],
    'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
    '@typescript-eslint/ban-ts-comment': [0],
  }
};
