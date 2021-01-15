import { isObject } from './utils/is'

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
      .replace(/\.([^\$])/g, '\\.$1')
  )
}

export function serializeItem(item: unknown): unknown {
  if (Array.isArray(item)) {
    return item.map(serializeItem)
  } else if (!isObject(item)) {
    return item
  }
  return Object.entries(item).reduce(
    (obj, [key, value]) => ({
      ...obj,
      [serializeKey(key)]: serializeItem(value),
    }),
    {}
  )
}

export function normalizeItem(item: unknown): unknown {
  if (Array.isArray(item)) {
    return item.map(normalizeItem)
  } else if (!isObject(item)) {
    return item
  }
  return Object.entries(item).reduce(
    (obj, [key, value]) => ({
      ...obj,
      [normalizeKey(key)]: normalizeItem(value),
    }),
    {}
  )
}
