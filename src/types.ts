import type { MongoClient, ChangeStream } from 'mongodb'
import type {
  Connection as ConnectionBase,
  Payload as BasePayload,
} from 'integreat'

export interface MongoData extends Record<string, unknown> {
  _id: string | Record<string, unknown>
}

export interface ParsedPageId {
  id: string | Record<string, unknown>
  filter: QueryObject[]
}

export interface QueryObject {
  path?: string
  op?: string
  param?: string
  value?: unknown
  valuePath?: string
  variable?: string
  expr?: boolean
}

export interface AggregationObjectSort {
  type: 'sort'
  sortBy: Record<string, 1 | -1>
}

export type GroupMethod =
  | 'first'
  | 'last'
  | 'sum'
  | 'avg'
  | 'max'
  | 'min'
  | 'push'

export interface GroupObject {
  op: GroupMethod
  path: string
}

export interface AggregationObjectGroup {
  type: 'group'
  groupBy: string[]
  values: Record<string, GroupMethod | GroupObject>
}

export interface AggregationObjectQuery {
  type: 'query'
  query: QueryObject[]
}

export interface AggregationObjectReduce {
  type: 'reduce'
  path: string
  initialPath: string | AggregationObject | AggregationObject[]
  pipeline: AggregationObject | AggregationObject[]
}

export interface AggregationObjectIf {
  type: 'if'
  condition: QueryObject | QueryObject[]
  then: AggregationObject | AggregationObject[] | unknown
  else: AggregationObject | AggregationObject[] | unknown
}

export interface AggregationObjectLimit {
  type: 'limit'
  count: number
}

export interface AggregationObjectUnwind {
  type: 'unwind'
  path: string
}

export interface AggregationObjectRoot {
  type: 'root'
  path: string
}

export interface AggregationObjectLookUp {
  type: 'lookup'
  collection: string
  field?: string
  path?: string
  setPath?: string
  variables?: Record<string, string>
  pipeline?: AggregationObject | AggregationObject[]
}

export interface AggregationObjectProject {
  type: 'project'
  values: Record<string, AggregationObject | AggregationObject[]>
}

export interface AggregationObjectConcatArrays {
  type: 'concatArrays'
  path: string[]
}

export interface SearchObject {
  type: 'autocomplete'
  value: string
  boostScore?: number
}

export interface AggregationObjectSearch {
  type: 'search'
  index?: string
  values: Record<string, SearchObject>
}

export type AggregationObject =
  | AggregationObjectSort
  | AggregationObjectGroup
  | AggregationObjectQuery
  | AggregationObjectReduce
  | AggregationObjectIf
  | AggregationObjectLimit
  | AggregationObjectUnwind
  | AggregationObjectRoot
  | AggregationObjectLookUp
  | AggregationObjectProject
  | AggregationObjectConcatArrays
  | AggregationObjectSearch

export interface IncomingOptions extends Record<string, unknown> {
  collections?: string[]
  db?: string
  idIsUnique?: boolean
}

export interface ServiceOptions extends Record<string, unknown> {
  uri?: string
  baseUri?: string
  db?: string
  collection?: string
  sort?: Record<string, 1 | -1>
  query?: QueryObject[]
  aggregation?: AggregationObject[]
  mongo?: Record<string, unknown>
  allowDiskUse?: boolean
  throwAfterFailedHeartbeatCount?: number
  idIsUnique?: boolean
  incoming?: IncomingOptions
}

export interface MongoClientObject {
  client: MongoClient | null
  count: number
}

export interface IncomingConnection {
  collections?: string[]
  db?: string
  streams?: ChangeStream[]
  idIsUnique?: boolean
}

export interface Connection extends ConnectionBase {
  mongo?: MongoClientObject
  error?: string
  incoming?: IncomingConnection
  emit?: (eventType: string, ...args: unknown[]) => void
}

export interface Payload extends BasePayload {
  type?: string | string[]
  id?: string | string[]
  pageSize?: number
  pageAfter?: string
  pageId?: string
}

export interface ChangeStreamEvent {
  operationType: 'insert' | 'update' | 'replace' | 'delete' | 'invalidate'
  fullDocument: unknown
  ns: {
    db: string
    coll: string
  }
  documentKey: { _id: string }
}
