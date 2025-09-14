import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { zkpRouter } from './zkp'

// Create Express app for testing (without rate limiting)
const app = express()
app.use(express.json())
app.use('/zkp', zkpRouter)

// Mock the reclaim module completely
vi.mock('../reclaim', () => ({
  createProofRequest: vi.fn(),
  verifyProof: vi.fn(),
  isProofAlreadyVerified: vi.fn(),
  ProofSchema: {
    safeParse: (data: any) => {
      if (data.payload === undefined) {
        return {
          success: false,
          error: {
            flatten: () => ({ fieldErrors: { payload: ['Required'] } })
          }
        }
      }
      return {
        success: true,
        data
      }
    }
  }
}))

// Mock the rate limiter to be a pass-through
vi.mock('../middleware/rateLimiter', () => ({
  createRateLimiter: () => (_req: any, _res: any, next: any) => next()
}))

// Mock database
vi.mock('../db', () => ({
  prisma: {
    user: {
      upsert: vi.fn()
    },
    game: {
      findFirst: vi.fn()
    },
    proof: {
      create: vi.fn(),
      findUnique: vi.fn()
    }
  }
}))

import * as reclaim from '../reclaim'
import { prisma } from '../db'

describe('ZKP Router - Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /zkp/request', () => {
    it('should create proof request successfully', async () => {
      const mockResponse = {
        mode: 'mock' as const,
        requestUrl: 'https://reclaim.example/mock',
        sessionId: 'mock-session-123',
        expiresAt: Date.now() + 5 * 60 * 1000
      }

      vi.mocked(reclaim.createProofRequest).mockResolvedValue(mockResponse)

      const res = await request(app)
        .post('/zkp/request')
        .send({ providerId: 'test-provider' })

      expect(res.status).toBe(200)
      expect(res.body).toEqual(mockResponse)
      expect(reclaim.createProofRequest).toHaveBeenCalledWith({
        providerId: 'test-provider'
      })
    })

    it('should handle errors in proof request creation', async () => {
      vi.mocked(reclaim.createProofRequest).mockRejectedValue(
        new Error('Failed to create request')
      )

      const res = await request(app)
        .post('/zkp/request')
        .send({ providerId: 'test' })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Failed to create request')
    })
  })

  describe('POST /zkp/verify', () => {
    const validProof = {
      sessionId: 'test-session',
      provider: 'steam',
      payload: { mock: true, data: 'test' }
    }

    it('should verify proof successfully', async () => {
      const mockUser = { id: 'user-1', steamId: 'STEAM_test-session' }
      const mockGame = { id: 'game-1', slug: 'counter-strike' }
      const mockProof = { id: 'proof-1' }
      const mockVerificationResult = {
        verified: true,
        reason: 'verified',
        details: { sessionId: 'test-session' }
      }

      vi.mocked(reclaim.isProofAlreadyVerified).mockResolvedValue(false)
      vi.mocked(reclaim.verifyProof).mockResolvedValue(mockVerificationResult)
      vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.game.findFirst).mockResolvedValue(mockGame as any)
      vi.mocked(prisma.proof.create).mockResolvedValue(mockProof as any)

      const res = await request(app)
        .post('/zkp/verify')
        .send(validProof)

      expect(res.status).toBe(200)
      expect(res.body).toEqual(mockVerificationResult)
      expect(reclaim.verifyProof).toHaveBeenCalledWith(validProof)
      expect(prisma.proof.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          gameId: 'game-1',
          provider: 'steam',
          verified: true,
          proofJson: validProof.payload,
          sessionId: 'test-session'
        }
      })
    })

    it('should reject invalid proof format', async () => {
      const res = await request(app)
        .post('/zkp/verify')
        .send({ invalid: 'data' }) // Missing payload

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid proof format')
      expect(res.body.details).toBeDefined()
    })

    it('should reject duplicate proof', async () => {
      vi.mocked(reclaim.isProofAlreadyVerified).mockResolvedValue(true)

      const res = await request(app)
        .post('/zkp/verify')
        .send(validProof)

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('Proof already verified')
      expect(res.body.sessionId).toBe('test-session')
      expect(reclaim.verifyProof).not.toHaveBeenCalled()
    })

    it('should handle verification failure', async () => {
      const mockVerificationResult = {
        verified: false,
        reason: 'invalid-proof',
        details: { error: 'Invalid signature' }
      }

      vi.mocked(reclaim.isProofAlreadyVerified).mockResolvedValue(false)
      vi.mocked(reclaim.verifyProof).mockResolvedValue(mockVerificationResult)

      const res = await request(app)
        .post('/zkp/verify')
        .send(validProof)

      expect(res.status).toBe(200)
      expect(res.body).toEqual(mockVerificationResult)
      expect(prisma.proof.create).not.toHaveBeenCalled()
    })

    it('should not store proof if verification fails', async () => {
      vi.mocked(reclaim.isProofAlreadyVerified).mockResolvedValue(false)
      vi.mocked(reclaim.verifyProof).mockResolvedValue({
        verified: false,
        reason: 'invalid-signature',
        details: { error: 'Signature mismatch' }
      })

      const res = await request(app)
        .post('/zkp/verify')
        .send(validProof)

      expect(res.status).toBe(200)
      expect(res.body.verified).toBe(false)
      expect(prisma.user.upsert).not.toHaveBeenCalled()
      expect(prisma.proof.create).not.toHaveBeenCalled()
    })

    it('should handle unique constraint violation', async () => {
      const dbError: any = new Error('Unique constraint failed')
      dbError.code = 'P2002'
      dbError.meta = { target: ['sessionId'] }

      vi.mocked(reclaim.isProofAlreadyVerified).mockResolvedValue(false)
      vi.mocked(reclaim.verifyProof).mockResolvedValue({
        verified: true,
        reason: 'verified',
        details: {}
      })
      vi.mocked(prisma.user.upsert).mockResolvedValue({ id: 'user-1', steamId: 'STEAM_test' } as any)
      vi.mocked(prisma.game.findFirst).mockResolvedValue({ id: 'game-1' } as any)
      vi.mocked(prisma.proof.create).mockRejectedValue(dbError)

      const res = await request(app)
        .post('/zkp/verify')
        .send(validProof)

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('Proof already verified')
      expect(res.body.sessionId).toBe('test-session')
    })
  })

  describe('POST /zkp/test/mock', () => {
    it('should create mock proof successfully', async () => {
      const mockUser = { id: 'user-test', steamId: 'STEAM_TEST' }
      const mockGame = { id: 'game-1', slug: 'counter-strike' }
      const mockProof = { id: 'proof-test' }

      vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.game.findFirst).mockResolvedValue(mockGame as any)
      vi.mocked(prisma.proof.create).mockResolvedValue(mockProof as any)

      const res = await request(app)
        .post('/zkp/test/mock')
        .send()

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.proofId).toBe('proof-test')
    })
  })
})