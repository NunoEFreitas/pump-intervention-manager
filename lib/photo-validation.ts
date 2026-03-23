/**
 * Validates a base64-encoded image by checking magic bytes, not the client-supplied MIME type.
 * Returns the detected MIME type or null if the data is not a recognised image format.
 */

const SIGNATURES: Array<{ mime: string; prefix: string }> = [
  { mime: 'image/jpeg', prefix: '/9j/' },
  { mime: 'image/png',  prefix: 'iVBORw0KGgo' },
  { mime: 'image/gif',  prefix: 'R0lGOD' },
  { mime: 'image/webp', prefix: 'UklGR' },
  { mime: 'image/heic', prefix: 'AAAAFGZ0eXBoZWlj' },
  { mime: 'image/heif', prefix: 'AAAAFGZ0eXBoZWlm' },
]

/** Strip the optional data-URL header (data:image/xxx;base64,) and return raw base64 */
export function stripDataUrl(data: string): string {
  const comma = data.indexOf(',')
  return comma !== -1 ? data.slice(comma + 1) : data
}

/**
 * Detect MIME type from base64 magic bytes.
 * Returns the detected MIME string, or null if unrecognised / not an image.
 */
export function detectImageMime(base64: string): string | null {
  const raw = stripDataUrl(base64).trimStart()
  for (const { mime, prefix } of SIGNATURES) {
    if (raw.startsWith(prefix)) return mime
  }
  return null
}

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024 // 8 MB (base64 string length)
