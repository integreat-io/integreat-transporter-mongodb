const commonConfig = require('./ava-common.config.cjs')

module.exports = {
  ...commonConfig,
  extensions: { ts: 'module' },
  nodeArguments: ['--loader=ts-node/esm', '--no-warnings'],
  ignoredByWatcher: ['{coverage,dist,media}/**', 'mongodb/**', '**/*.md'],
  files: ['src/**/*.test.ts'],
}
