import { Request, Response, NextFunction } from 'express'

interface RateLimitStore {
  attempts: number
  resetTime: number
}

const store = new Map<string, RateLimitStore>()

export interface RateLimitOptions {
  windowMs?: number // Time window in milliseconds
  maxRequests?: number // Maximum number of requests per window
  message?: string // Error message when rate limit exceeded
  keyGenerator?: (req: Request) => string // Function to generate unique key
}

export function createRateLimiter(options: RateLimitOptions = {}) {
  const {
    windowMs = 60 * 1000, // 1 minute default
    maxRequests = 10, // 10 requests per minute default
    message = 'Too many requests, please try again later',
    keyGenerator = (req) => req.ip || 'unknown'
  } = options

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req)
    const now = Date.now()

    // Get or create rate limit data for this key
    let rateLimit = store.get(key)

    if (!rateLimit || now > rateLimit.resetTime) {
      rateLimit = {
        attempts: 0,
        resetTime: now + windowMs
      }
      store.set(key, rateLimit)
    }

    rateLimit.attempts++

    // Check if rate limit exceeded
    if (rateLimit.attempts > maxRequests) {
      const retryAfter = Math.ceil((rateLimit.resetTime - now) / 1000)
      res.setHeader('Retry-After', retryAfter.toString())
      res.setHeader('X-RateLimit-Limit', maxRequests.toString())
      res.setHeader('X-RateLimit-Remaining', '0')
      res.setHeader('X-RateLimit-Reset', new Date(rateLimit.resetTime).toISOString())

      console.warn(`[RateLimit] Limit exceeded for ${key}: ${rateLimit.attempts}/${maxRequests}`)

      return res.status(429).json({
        error: message,
        retryAfter
      })
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString())
    res.setHeader('X-RateLimit-Remaining', (maxRequests - rateLimit.attempts).toString())
    res.setHeader('X-RateLimit-Reset', new Date(rateLimit.resetTime).toISOString())

    next()
  }
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of store.entries()) {
    if (now > value.resetTime + 60000) { // Remove entries older than 1 minute past reset
      store.delete(key)
    }
  }
}, 60000) // Run cleanup every minute