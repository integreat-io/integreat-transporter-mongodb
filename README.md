# MongoDB support for Integreat

Transporter that lets
[Integreat](https://github.com/integreat-io/integreat) use a MongoDB database
as service.

[![npm Version](https://img.shields.io/npm/v/integreat-transporter-mongodb.svg)](https://www.npmjs.com/package/integreat-transporter-mongodb)
[![Maintainability](https://api.codeclimate.com/v1/badges/4e1f602444ddb8b13527/maintainability)](https://codeclimate.com/github/integreat-io/integreat-transporter-mongodb/maintainability)

## Getting started

### Prerequisits

Requires at least node v18, Integreat v1.0, and MongoDb 5.0.

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
`SET`, `UPDATE`, and `DELETE` actions the data will be result stats in the form
of `{ modifiedCount: 1, insertedCount: 2, deletedCount: 0 }`.

`UPDATE` actions will respond with a `notfound` error if one or more of the
provided data items are not already in the database.

`GET` actions will also return a `totalCount` in the `params` object of the
response, with the total number of documents matching the query. This is useful
for paged queries.

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

#### MongoDB's \_id field

MongoDB uses an `_id` field as the primary key for documents. By default, we
user let MongoDB generate this field and never touch it, but if you set
`idIsUnique: true` in the option, signaling that the `id` of the data items
you'll send to the mongodb transporter will always be unique, we'll map the `id`
to `_id` and back again.

One of the advantages of this is that, in addition to not have an extra id
field, MongoDB will always create an index for `_id`, so this may speed up
operations on the collection without any extra setup.

#### Serializing and normalizing

Some characters are not allowed in MongoDB keys, so we have to escape them when
setting data to MongoDB. Leading `$` is escape with a `\`, and `.` is escaped
with a `\_`. This is done automatically by the transporter, and reverted when
values are fetched, but you will see it if you query data directly from the
database.

Integreat accepts using an empty string `''` as a key in an object (as does
JavaScript and JSON), but MongoDB does not. We therefore replace empty strings
keys with the string `'**empty**'` when storing data in MongoDB, and normalizes
it back when fetching data.

Also, we remove all properties with a `undefined` value, to not fill the
database with empty values. This also means that existing values are not
overwritten with `undefined` when updating documents. This is usually what you
want when updating data from Integreat, and it's easy to end up with unintended
`undefined` values from mutation pipelines, but if you actually want to set
`undefined` values, you can do so by setting the `keepUndefined` option to
`true`. Note that `undefined` values in an array are always preserved, e.g.
`['ent1', undefined, 'ent3']`. Also, note that MongoDb will turn `undefined`
into `null`.

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

To do a match on objects in an array, use the `match` operand. This will match
any document with an array at `path` that contains an object with the properties
specified in `value` or `param`. This uses MongoDB's `$elemMatch` operator under
the hood.

To do a text search in the text index set up for th collection, use the `search`
operand and set `value` to search string or `param` to the parameter that holds
the search string. See MongoDb docs for more on
[setting up a text index](https://www.mongodb.com/docs/drivers/node/current/fundamentals/crud/read-operations/text/).

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

There are two types of pagination; `pageId` or `pageOffset`. The first one is
used by default, and returns an id for the next page in the dataset. All details
around this id is internal to the transporter and may change without being
considered a breaking change. Used treat it as an id and you'll be find.

The `pageOffset` approach kicks in when a `pageOffset` param is specified on the
action, so to use this approach, you need to set `pageOffset: 0` for the first
page. If the `pageSize` is e.g. `100`, the next `pageOffset` will be `100`, etc.

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
