import { Router } from 'express'
import { z } from 'zod'
import { createProofRequest, ProofSchema, verifyProof, isProofAlreadyVerified, createSteamProof, verifySteamProof } from '../reclaim.js'
import { prisma } from '../db.js'
import { createRateLimiter } from '../middleware/rateLimiter.js'

export const zkpRouter = Router()

// Rate limiters for different endpoints
const requestLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 requests per minute
  message: 'Too many proof requests, please try again later'
})

const verifyLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 verifications per minute
  message: 'Too many verification attempts, please try again later'
})

// Schema for Steam proof request
const SteamProofRequestSchema = z.object({
  steamId: z.string(),
  userDataUrl: z.string().url(),
  cookieStr: z.string(),
  targetAppId: z.string().optional()
})

// Schema for Steam proof verification
const SteamProofVerifySchema = z.object({
  proof: z.any(),
  steamId: z.string(),
  targetAppId: z.string().optional()
})

zkpRouter.post('/request', requestLimiter, async (req, res) => {
  try {
    const { providerId } = (req.body || {}) as { providerId?: string }
    const r = await createProofRequest({ providerId })
    res.json(r)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

zkpRouter.post('/verify', verifyLimiter, async (req, res) => {
  const parse = ProofSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      error: 'Invalid proof format',
      details: parse.error.flatten()
    })
  }

  try {
    // Check for duplicate proof if sessionId is provided
    if (parse.data.sessionId) {
      const isDuplicate = await isProofAlreadyVerified(
        parse.data.sessionId,
        async (sessionId) => prisma.proof.findUnique({ where: { sessionId } })
      )

      if (isDuplicate) {
        console.log(`[ZKP] Duplicate proof attempt for session: ${parse.data.sessionId}`)
        return res.status(409).json({
          error: 'Proof already verified',
          sessionId: parse.data.sessionId
        })
      }
    }

    // Verify the proof
    const result = await verifyProof(parse.data)

    // Only persist if verification succeeded
    if (result.verified) {
      // Create or update user
      const user = await prisma.user.upsert({
        where: { steamId: 'STEAM_' + (parse.data.sessionId || 'unknown') },
        update: { steamId: 'STEAM_' + (parse.data.sessionId || 'unknown') },
        create: { steamId: 'STEAM_' + (parse.data.sessionId || 'unknown') }
      })

      // Find game (optional)
      const game = await prisma.game.findFirst({ where: { slug: 'counter-strike' } })

      // Store proof with sessionId for duplicate prevention
      await prisma.proof.create({
        data: {
          userId: user.id,
          gameId: game?.id,
          provider: parse.data.provider,
          verified: result.verified,
          proofJson: parse.data.payload,
          sessionId: parse.data.sessionId || null
        }
      })

      console.log(`[ZKP] Proof verified and stored for user: ${user.id}`)
    } else {
      console.warn(`[ZKP] Proof verification failed: ${result.reason}`)
    }

    res.json(result)
  } catch (e: any) {
    console.error('[ZKP] Verification error:', e)

    // Check for unique constraint violation (duplicate sessionId)
    if (e.code === 'P2002' && e.meta?.target?.includes('sessionId')) {
      return res.status(409).json({
        error: 'Proof already verified',
        sessionId: parse.data.sessionId
      })
    }

    res.status(500).json({
      error: 'Verification failed',
      message: e?.message || 'Internal server error'
    })
  }
})

// Test helper: inserts a mock proof row
zkpRouter.post('/test/mock', async (_req, res) => {
  const u = await prisma.user.upsert({
    where: { steamId: 'STEAM_TEST' },
    update: {},
    create: { steamId: 'STEAM_TEST' }
  })
  const g = await prisma.game.findFirst({ where: { slug: 'counter-strike' } })
  const p = await prisma.proof.create({
    data: {
      userId: u.id,
      gameId: g?.id,
      provider: 'steam',
      verified: true,
      proofJson: { mock: true, inserted: true }
    }
  })
  res.json({ ok: true, proofId: p.id })
})

// Steam-specific endpoints with rate limiting
zkpRouter.post('/steam/proof', requestLimiter, async (req, res) => {
  const parse = SteamProofRequestSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request parameters',
      details: parse.error.issues
    })
  }

  try {
    console.log('Creating Steam proof for:', parse.data.steamId)
    const result = await createSteamProof(parse.data)

    // Store proof request in database (optional)
    if (!process.env.ZKP_MOCK || process.env.ZKP_MOCK === 'false') {
      const user = await prisma.user.upsert({
        where: { steamId: parse.data.steamId },
        update: {},
        create: { steamId: parse.data.steamId }
      })

      // Log the proof request
      console.log(`Proof created for user ${user.id} (${parse.data.steamId})`)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Steam proof creation failed:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create proof'
    })
  }
})

zkpRouter.post('/steam/verify', verifyLimiter, async (req, res) => {
  const parse = SteamProofVerifySchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid verification parameters',
      details: parse.error.issues
    })
  }

  try {
    console.log('Verifying Steam proof for:', parse.data.steamId)
    const result = await verifySteamProof(parse.data.proof)

    if (result.verified) {
      // Store verified proof in database
      const user = await prisma.user.upsert({
        where: { steamId: parse.data.steamId },
        update: {},
        create: { steamId: parse.data.steamId }
      })

      // Find game if targetAppId provided
      let gameId = null
      if (parse.data.targetAppId) {
        const game = await prisma.game.findFirst({
          where: { slug: parse.data.targetAppId } // Note: might need to adjust this based on your schema
        })
        gameId = game?.id
      }

      await prisma.proof.create({
        data: {
          userId: user.id,
          gameId: gameId,
          provider: 'steam',
          verified: true,
          proofJson: parse.data.proof,
          sessionId: result.sessionId || null // Add sessionId if available
        }
      })

      console.log(`Proof verified and stored for user ${user.id}`)
    }

    res.json({
      success: result.verified,
      ...result
    })
  } catch (error: any) {
    console.error('Steam proof verification failed:', error)

    // Check for duplicate proof
    if (error.code === 'P2002' && error.meta?.target?.includes('sessionId')) {
      return res.status(409).json({
        success: false,
        error: 'Proof already verified'
      })
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify proof'
    })
  }
})