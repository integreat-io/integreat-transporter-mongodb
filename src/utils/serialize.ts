import { isObject } from './is.js'

const serializeDollarHead = (key: string) =>
  key.startsWith('$') ? `\\${key}` : key
const normalizeDollarHead = (key: string) =>
  key.startsWith('\\$') ? `${key.slice(1)}` : key

const serializeKey = (key: string) =>
  key === ''
    ? '**empty**'
    : serializeDollarHead(key.replace(/\\/g, '\\\\').replace(/\./g, '\\_'))
const normalizeKey = (key: string) =>
  key === '**empty**'
    ? ''
    : normalizeDollarHead(key)
        .replace(/(^|[^\\]|\\\\)\\_/g, '$1.')
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

const isInc = (value: unknown): value is { $inc: number } =>
  isObject(value) && typeof value.$inc === 'number'

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
  return Object.entries(item)
    .filter(([, value]) => keepUndefined || value !== undefined) // Remove all `undefined` values
    .map(([key, value]): [string, unknown] =>
      isInc(value)
        ? ['$inc', { [key]: value.$inc }]
        : [serializeKey(key), serializeItem(value, keepUndefined)],
    )
    .reduce(
      (obj, [key, value]) =>
        key === '$inc' && obj.$inc && isObject(value)
          ? { ...obj, $inc: { ...obj.$inc, ...value } }
          : { ...obj, [key]: value },
      {} as Record<string, unknown>,
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
