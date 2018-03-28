# MongoDB support for Integreat

Adapter that lets
[Integreat](https://github.com/integreat-io/integreat) use a MongoDB database
as source.

[![Build Status](https://travis-ci.org/integreat-io/integreat-adapter-mongodb.svg?branch=master)](https://travis-ci.org/integreat-io/integreat-adapter-mongodb)
[![Coverage Status](https://coveralls.io/repos/github/integreat-io/integreat-adapter-mongodb/badge.svg?branch=master)](https://coveralls.io/github/integreat-io/integreat-adapter-mongodb?branch=master)
[![Dependencies Status](https://tidelift.com/badges/github/integreat-io/integreat-adapter-mongodb?style=flat)](https://tidelift.com/repo/github/integreat-io/integreat-adapter-mongodb)

## Getting started

### Prerequisits

Requires node v8.6 and Integreat v0.6.

### Installing and using

Install from npm:

```
npm install integreat-adapter-mongodb
```

Example of use:
```javascript
const integreat = require('integreat')
const mongodb = require('integreat-adapter-mongodb')
const defs = require('./config')

const resources = mongodb(integreat.resources())
const great = integreat(defs, resources)

// ... and then dispatch actions as usual
```

The `mongodb()` function adds the adapter `mongodb` to the resources object, but
you still need to configure your source to use it.

Example source configuration:

```javascript
{
  id: 'store',
  adapter: 'mongodb',
  auth: 'db',
  baseUri: 'mongodb://mymongo.com',
  endpoints: [
    {options: {db: 'store', collection: 'documents'}}
  ]
}
```

The `baseUri` is used as the uri to the database.

### Running the tests

The tests can be run with `npm test`.

## Contributing

Please read
[CONTRIBUTING](https://github.com/integreat-io/integreat-adapter-mongodb/blob/master/CONTRIBUTING.md)
for details on our code of conduct, and the process for submitting pull
requests.

## License

This project is licensed under the ISC License - see the
[LICENSE](https://github.com/integreat-io/integreat-adapter-mongodb/blob/master/LICENSE)
file for details.
