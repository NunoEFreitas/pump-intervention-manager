/**
 * Simple in-memory rate limiter.
 * Sufficient for a ~30-user deployment on a single Node.js process.
 * Resets on process restart (acceptable for this use case).
 */

interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

/**
 * Check whether a key (typically an IP address) has exceeded the limit.
 * @param key      Identifier for the requester (IP or user ID)
 * @param limit    Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 * @returns true if the request should be blocked
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }

  bucket.count++
  if (bucket.count > limit) return true

  return false
}

// Periodically clean up expired entries to avoid memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key)
  }
}, 60_000)
