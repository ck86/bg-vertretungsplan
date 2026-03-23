const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 30

const buckets = new Map<string, { count: number; windowStart: number }>()

export function allowSubscribeRequest(clientKey: string): boolean {
  const now = Date.now()
  const b = buckets.get(clientKey)
  if (!b || now - b.windowStart > WINDOW_MS) {
    buckets.set(clientKey, { count: 1, windowStart: now })
    return true
  }
  if (b.count >= MAX_REQUESTS) {
    return false
  }
  b.count += 1
  return true
}

export function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}
