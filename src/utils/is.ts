import type { TypedData } from 'integreat'
import type { MongoData } from '../types.js'

export interface ObjectWithId extends Record<string, unknown> {
  id: string | number
  $type?: string
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

export const isObjectWithId = (value: unknown): value is ObjectWithId =>
  isObject(value) &&
  (typeof value.id === 'string' || typeof value.id === 'number')

export const isMongoData = (value: unknown): value is MongoData =>
  isObject(value) && !!value._id

export const isTypedData = (value: unknown): value is TypedData =>
  isObject(value) && typeof value.id === 'string'

export const isNotEmpty = <T>(value: T): value is NonNullable<T> => !!value
