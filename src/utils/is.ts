import { TypedData } from 'integreat'

export const isObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

export const isTypedData = (value: unknown): value is TypedData =>
  isObject(value) && typeof value.$type === 'string'
