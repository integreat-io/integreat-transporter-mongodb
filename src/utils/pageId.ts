/* eslint-disable security/detect-object-injection */
import { atob } from './base64.js'
import { QueryObject } from '../types.js'

export interface DecodedPageId {
  id: string | Record<string, unknown>
  filter: QueryObject[]
}

const partRegex = /[\<\>]/

function decodePartValue(value: string) {
  if (value.startsWith('"')) {
    return decodeURIComponent(value.slice(1, value.lastIndexOf('"')))
  } else {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
}

function createQueryObjectFromPageIdPart(part: string) {
  const match = part.split(partRegex)
  return match.length === 2
    ? {
        path: match[0],
        op: part.includes('>') ? 'gte' : 'lte',
        value: decodePartValue(match[1]),
      }
    : undefined
}

function filterFromParts(
  parts: string[],
  id: string | Record<string, unknown>,
): QueryObject[] {
  if (parts.length === 1 && parts[0] === '>') {
    return [{ path: 'id', op: 'gte', value: id }]
  } else {
    return parts
      .map(createQueryObjectFromPageIdPart)
      .filter(Boolean) as QueryObject[]
  }
}

function extractIdAndParts(
  pageId: string,
): [string | Record<string, unknown>, string[]] {
  const aggParts = pageId.split('||')

  if (aggParts.length === 1) {
    const parts = pageId.split('|')
    return [parts[0], parts.slice(1)]
  } else {
    const idParts = aggParts[0].split('|')
    const id: Record<string, unknown> = {}
    for (let i = 0; i < idParts.length; i += 2) {
      id[idParts[i]] = decodePartValue(idParts[i + 1])
    }
    const parts = aggParts[1]?.split('|') || []
    return [id, parts]
  }
}

export function decodePageId(
  encodedPageId?: string,
): DecodedPageId | undefined {
  const pageId = atob(encodedPageId)
  if (typeof pageId !== 'string') {
    return undefined
  }

  const [id, parts] = extractIdAndParts(pageId)
  const filter = filterFromParts(parts, id)

  return { id, filter }
}
