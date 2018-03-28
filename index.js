const adapter = require('./lib/adapter')
const wrapper = require('./lib/wrapper')

wrapper.adapter = adapter

module.exports = wrapper
