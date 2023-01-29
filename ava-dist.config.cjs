const commonConfig = require('./ava-common.config.cjs')

module.exports = {
  ...commonConfig,
  files: ['dist/**/*.test.js'],
}
