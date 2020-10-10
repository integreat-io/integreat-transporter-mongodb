export const btoa = (dec?: string): string | undefined =>
  dec ? Buffer.from(dec).toString('base64') : undefined
export const atob = (enc?: string): string | undefined =>
  enc ? Buffer.from(enc, 'base64').toString() : undefined

export const removePadding = (str?: string): string | undefined =>
  str?.replace(/={1,2}$/, '')
