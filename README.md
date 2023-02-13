# MongoDB support for Integreat

Transporter that lets
[Integreat](https://github.com/integreat-io/integreat) use a MongoDB database
as service.

[![Build Status](https://travis-ci.org/integreat-io/integreat-transporter-mongodb.svg?branch=master)](https://travis-ci.org/integreat-io/integreat-transporter-mongodb)
[![Coverage Status](https://coveralls.io/repos/github/integreat-io/integreat-transporter-mongodb/badge.svg?branch=master)](https://coveralls.io/github/integreat-io/integreat-transporter-mongodb?branch=master)

## Getting started

### Prerequisits

Requires at least node v12.9, Integreat v0.8, and MongoDb 3.6.

### Installing and using

Install from npm:

```
npm install integreat-transporter-mongodb
```

Example of use:

```javascript
import Integreat from 'integreat'
import mongodb from 'integreat-transporter-mongodb'
import defs from './config'

const resources = {
  // ... you'll probably want to include other resources as well
  transporters: { mongodb },
}
const great = Integreat.create(defs, resources)

// ... and then dispatch actions as usual
```

The data returns from `GET` actions will be the retrieved documents, while for
`SET` and `DELETE` actions the data will be result stats in the form of
`{ modifiedCount: 1, insertedCount: 2, deletedCount: 0 }`.

After including the `mongodb` transporter in your resources object, you still
need to configure your service to use it.

Example service configuration:

```javascript
{
  id: 'store',
  transporter: 'mongodb',
  auth: 'mongoAuth', // See below for documentation of authentication
  options: {
    uri: 'mongodb://mymongo.com',
  }
  endpoints: [
    { options: { db: 'store', collection: 'documents' } }
  ]
}
```

The `uri` is used as the uri to the database.

#### Querying

An endpoint may have a `query` property, which should be an array of path
objects describing the query object used with MongoDB's `find()` method.

Here's an example:

```javascript
{
  ...
  endpoints: [
    {
      id: 'getDrafts',
      options: {
        db: 'store',
        collection: 'documents',
        query: [
          { path: 'type', param: 'type' },
          { path: 'meta.status', value: 'draft' }
          { path: 'meta.views', op: 'gt', value: 1000 }
        ],
        allowDiskUse: true
      }
    }
  ]
}
```

The `path` property describes what property to set, and the property is set to
the value of `value` or to the value of the request parameter in `param`. The
default operand is `eq`, but you may also use `gt`, `gte`, `lt`, `lte`, or `in`.

There are also two special operands: `isset` and `notset`. They will match when
a field is set or not.

The query object will look like this, for a request for items of type `entry`:

```javascript
{
  type: 'entry',
  'meta.status': 'draft',
  'meta.views': { $gt: 1000 }
}
```

To specify or logic, you put several queries in an array. To have and logic
within an or array, you again use an array.

To query for type _and_ a `meta.status` of `draft` _or_ `published`:

```javascript
// ...
query: [
  { path: 'type', param: 'type' },
  [
    // or
    { path: 'meta.status', value: 'draft' },
    { path: 'meta.status', value: 'published' },
  ],
]
```

To query for type _and_ a `meta.status` of `draft` _or_ `published`, with
`draft` having an _and_ logic with `meta.author.role`:

```javascript
// ...
query: [
  { path: 'type', param: 'type' },
  [
    // or
    [
      // and
      { path: 'meta.status', value: 'draft' },
      { path: 'meta.author.role', value: 'author' },
    ],
    { path: 'meta.status', value: 'published' },
  ],
]
```

When no query is specified and the action has an `id` param, the following query
will be used by default (the value of `id` is `'ent1'` in this example):

```javascript
{
  id: 'ent1',
}

```

#### Pagination

When the `pageSize` param is set in a request, it is taken as the max number of
documents to return in the response. When nothing else is specified, the first
page of documents is returned, and the `paging.next` prop on the response will
hold a params object that may be used to get the next page.

Aggregation is supported by specifying a pipeline on the `aggregation` property
on the `options` object. If a query or a sort order is specified, they are put
first in the aggregation pipeline, query first, then sorting. Aggregations don't
support paging, and combining `pageSize` with `aggregation` will give a
`badrequest` error.

Example of an aggregation pipeline:

```javascript
{
  ...
  endpoints: [
    {
      id: 'getNewestVersion',
      options: {
        db: 'store',
        collection: 'documents',
        aggregation: [
          { type: 'sort', sortBy: { updatedAt: -1 } },
          {
            type: 'group',
            groupBy: ['account', 'id'],
            values: { updatedAt: 'first', status: 'first' },
          },
          {
            type: 'query',
            query: [
              { path: 'updatedAt', op: 'gt', param: 'updatedAfter' },
            ],
          },
        ]
      }
    }
  ]
}
```

**Note:** As MongoDB does not allow keys with `.` in it or starting with `$`,
so these characters are mapped. `.` is always mapped to `\_`, and `$` is mapped
to `\$` when used at the beginning of a key. Consequently, `\` is mapped to
`\\` as well.

#### Authentication

We recommend using Integreat's built in authentication mechanism to authenticate
with MongoDB. To do this, set the id of an auth object on the `auth` prop of the
service definition -- in the example above this is set to `mongoAuth`. Then
define an auth object like this:

```javascript
{
  id: 'mongoAuth',
  authenticator: 'options',
  options: {
    key: '<mongo username>',
    secret: '<mongo password>',
  }
}
```

The `options` authenticator will simply pass on the options object to Integreat,
which will again pass it on to the MongoDB transport -- which will know how to
use this to authenticate with MongoDB.

**Note:** Including credential in the connection uri, is a fairly common
practice with MongoDB. When using this approach, tell Integreat that the service
is authenticated by setting `auth: true` on the service definition. However, we
not recommend this approach, as the username and password is then included in
the definition file and this makes the chance of it being e.g. commited to a git
repo, much higher.

#### Heartbeat

**Experimental:** By setting a number on the `throwAfterFailedHeartbeatCount`
option, the transporter will throw after the number of heartbeat failures you
specify. The counter will reset for every sucessful heartbeat, so if
`throwAfterFailedHeartbeatCount` is `3`, it will throw when after three
heartbeat failures in a row.

The point of this is to allow the server to restart after loosing contact with
MongoDb.

### Running the tests

The tests can be run with `npm test`.

## Contributing

Please read
[CONTRIBUTING](https://github.com/integreat-io/integreat-transporter-mongodb/blob/master/CONTRIBUTING.md)
for details on our code of conduct, and the process for submitting pull
requests.

## License

This project is licensed under the ISC License - see the
[LICENSE](https://github.com/integreat-io/integreat-transporter-mongodb/blob/master/LICENSE)
file for details.
