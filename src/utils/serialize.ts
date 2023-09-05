import { isObject } from './is.js'

const serializeDollarHead = (key: string) =>
  key.startsWith('$') ? `\\${key}` : key
const normalizeDollarHead = (key: string) =>
  key.startsWith('\\$') ? `${key.slice(1)}` : key

const serializeKey = (key: string) =>
  serializeDollarHead(key.replace(/\\/g, '\\\\').replace(/\./g, '\\_'))
const normalizeKey = (key: string) =>
  normalizeDollarHead(key)
    .replace(/([^\\]|\\\\)\\_/g, '$1.')
    .replace(/\\\\/g, '\\')

export function serializePath(path: string): string {
  return serializeDollarHead(
    path
      .replace(/\\/g, '\\\\')
      .replace(/\\\\\./g, '\\_')
      .replace(/\.([^\$])/g, '\\.$1'),
  )
}

const shouldSkipProp = (key: string) => key === '__totalCount'

/**
 * Prepare data for MongoDB. We need to escape all dots and leading dollars in
 * keys, as they are reserved. They will be unescaped in `normalizeItem`.
 */
export function serializeItem(item: unknown, keepUndefined = false): unknown {
  if (Array.isArray(item)) {
    return item.map((it) => serializeItem(it, keepUndefined))
  } else if (!isObject(item)) {
    return item
  }
  return Object.fromEntries(
    Object.entries(item)
      .filter(([, value]) => keepUndefined || value !== undefined) // Remove all `undefined` values
      .map(([key, value]) => [
        serializeKey(key),
        serializeItem(value, keepUndefined),
      ]),
  )
}

/**
 * Normalize data from MongoDB. We unescape all dots and leading dollars in
 * keys.
 */
export function normalizeItem(item: unknown): unknown {
  if (Array.isArray(item)) {
    return item.map(normalizeItem)
  } else if (!isObject(item)) {
    return item
  }
  return Object.fromEntries(
    Object.entries(item)
      .filter(([key]) => !shouldSkipProp(key))
      .map(([key, value]) => [normalizeKey(key), normalizeItem(value)]),
  )
}
