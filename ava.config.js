import commonConfig from './ava-common.config.js'

export default {
  ...commonConfig,
  environmentVariables: {
    ...commonConfig.environmentVariables,
    TSIMP_DIAG: 'ignore',
  },
  extensions: { ts: 'module' },
  nodeArguments: ['--import=tsimp'],
  watchMode: {
    ignoreChanges: ['{coverage,dist,media,.tsimp}/**', 'mongodb/**', '**/*.md'],
  },
  files: ['src/**/*.test.ts'],
}
