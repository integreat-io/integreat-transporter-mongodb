const baseConfig = require('./node_modules/@integreat/ts-dev-setup/ava.config.cjs')
const commonConfig = require('./ava-common.config.cjs')

module.exports = {
  ...baseConfig,
  ...commonConfig,
}
