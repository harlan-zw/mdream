import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    '**/.mdream/**',
    '**/examples/**',
    'docs/**',
  ],
  rules: {
    'no-use-before-define': 'off',
    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
    // TODO re-enable when not broken
    'vue/no-empty-pattern': 'off',
  },
}, {
  files: ['**/test/**/*.ts', '**/test/**/*.js'],
  rules: {
    'ts/no-unsafe-function-type': 'off',
    'no-console': 'off',
    'regexp/no-super-linear-backtracking': 'off',
  },
})
