const adapter = require('./adapter')

function wrapResources (resources) {
  const {adapters} = resources
  return {
    ...resources,
    adapters: {...adapters, mongodb: adapter}
  }
}

module.exports = wrapResources
