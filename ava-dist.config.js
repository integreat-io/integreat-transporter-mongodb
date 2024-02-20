import commonConfig from './ava-common.config.js'

export default {
  ...commonConfig,
  files: ['dist/**/*.test.js'],
}
