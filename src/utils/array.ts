export const ensureArray = <T>(data: T | T[]): T[] =>
  Array.isArray(data) ? data : data === undefined ? [] : [data]

export const dearrayIfPossible = <T>(data: T | T[]): T | T[] | undefined =>
  Array.isArray(data)
    ? data.length === 1
      ? data[0]
      : data.length === 0
      ? undefined
      : data
    : data
