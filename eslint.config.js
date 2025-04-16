import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'no-use-before-define': 'off',
    'node/prefer-global/process': 'off',
    // TODO re-enable when not broken
    'vue/no-empty-pattern': 'off',
  },
})
