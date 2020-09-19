export interface ObjectWithId extends Record<string, unknown> {
  id: string | number
  $type?: string
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

export const isObjectWithId = (value: unknown): value is ObjectWithId =>
  isObject(value) &&
  (typeof value.id === 'string' || typeof value.id === 'number')
