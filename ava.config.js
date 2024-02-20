import commonConfig from './ava-common.config.js'

export default {
  ...commonConfig,
  extensions: { ts: 'module' },
  nodeArguments: ['--import=tsimp'],
  watchMode: {
    ignoreChanges: ['{coverage,dist,media}/**', 'mongodb/**', '**/*.md'],
  },
  files: ['src/**/*.test.ts'],
}
