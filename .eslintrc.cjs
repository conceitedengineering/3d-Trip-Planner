module.exports = {
  root: true,
  extends: ['./packages/eslint-config/index.cjs'],
  ignorePatterns: ['**/dist/**', '**/coverage/**', '**/.wrangler/**']
};
