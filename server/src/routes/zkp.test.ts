import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { zkpRouter } from './zkp'
import * as reclaim from '../reclaim'
import { prisma } from '../db'

// Create Express app for testing
const app = express()
app.use(express.json())
app.use('/zkp', zkpRouter)

// Mock modules
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

vi.mock('../reclaim', () => ({
  createProofRequest: vi.fn(),
  verifyProof: vi.fn(),
  isProofAlreadyVerified: vi.fn(),
  ProofSchema: {
    safeParse: vi.fn()
  }
}))

describe('ZKP Router', () => {
  let rateLimitStore: Map<string, any>

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
        mode: 'mock',
        requestUrl: 'https://reclaim.example/mock',
        sessionId: 'mock-session-123'
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

    it('should handle request without providerId', async () => {
      const mockResponse = {
        mode: 'mock',
        requestUrl: 'https://reclaim.example/mock',
        sessionId: 'mock-session-456'
      }

      vi.mocked(reclaim.createProofRequest).mockResolvedValue(mockResponse)

      const res = await request(app)
        .post('/zkp/request')
        .send({})

      expect(res.status).toBe(200)
      expect(res.body).toEqual(mockResponse)
      expect(reclaim.createProofRequest).toHaveBeenCalledWith({
        providerId: undefined
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

    it.skip('should be rate limited after too many requests', async () => {
      const mockResponse = {
        mode: 'mock',
        requestUrl: 'https://reclaim.example/mock',
        sessionId: 'mock-session-789'
      }

      vi.mocked(reclaim.createProofRequest).mockResolvedValue(mockResponse)

      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/zkp/request')
          .send({ providerId: 'test' })
        expect(res.status).toBe(200)
      }

      // 6th request should be rate limited
      const res = await request(app)
        .post('/zkp/request')
        .send({ providerId: 'test' })

      expect(res.status).toBe(429)
      expect(res.body.error).toContain('Too many proof requests')
      expect(res.headers['retry-after']).toBeDefined()
      expect(res.headers['x-ratelimit-limit']).toBe('5')
      expect(res.headers['x-ratelimit-remaining']).toBe('0')
    })
  })

  describe('POST /zkp/verify', () => {
    const validProof = {
      sessionId: 'test-session',
      provider: 'steam',
      payload: { mock: true, data: 'test' }
    }

    beforeEach(() => {
      // Reset ProofSchema mock
      vi.mocked(reclaim.ProofSchema.safeParse).mockReturnValue({
        success: true,
        data: validProof
      } as any)
    })

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
      vi.mocked(reclaim.ProofSchema.safeParse).mockReturnValue({
        success: false,
        error: {
          flatten: () => ({ fieldErrors: { payload: ['Required'] } })
        }
      } as any)

      const res = await request(app)
        .post('/zkp/verify')
        .send({ invalid: 'data' })

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

    it.skip('should handle database errors', async () => {
      vi.mocked(reclaim.isProofAlreadyVerified).mockResolvedValue(false)
      vi.mocked(reclaim.verifyProof).mockResolvedValue({
        verified: true,
        reason: 'verified'
      } as any)
      vi.mocked(prisma.user.upsert).mockRejectedValue(new Error('DB Error'))

      const res = await request(app)
        .post('/zkp/verify')
        .send(validProof)

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Verification failed')
      expect(res.body.message).toBe('DB Error')
    })

    it.skip('should handle unique constraint violation', async () => {
      const dbError: any = new Error('Unique constraint failed')
      dbError.code = 'P2002'
      dbError.meta = { target: ['sessionId'] }

      vi.mocked(reclaim.isProofAlreadyVerified).mockResolvedValue(false)
      vi.mocked(reclaim.verifyProof).mockResolvedValue({
        verified: true,
        reason: 'verified'
      } as any)
      vi.mocked(prisma.user.upsert).mockResolvedValue({ id: 'user-1' } as any)
      vi.mocked(prisma.game.findFirst).mockResolvedValue({ id: 'game-1' } as any)
      vi.mocked(prisma.proof.create).mockRejectedValue(dbError)

      const res = await request(app)
        .post('/zkp/verify')
        .send(validProof)

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('Proof already verified')
      expect(res.body.sessionId).toBe('test-session')
    })

    it.skip('should be rate limited after too many verifications', async () => {
      vi.mocked(reclaim.isProofAlreadyVerified).mockResolvedValue(false)
      vi.mocked(reclaim.verifyProof).mockResolvedValue({
        verified: false,
        reason: 'test'
      } as any)

      // Make 10 requests (the limit)
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post('/zkp/verify')
          .send(validProof)
        expect(res.status).toBe(200)
      }

      // 11th request should be rate limited
      const res = await request(app)
        .post('/zkp/verify')
        .send(validProof)

      expect(res.status).toBe(429)
      expect(res.body.error).toContain('Too many verification attempts')
    })

    it.skip('should not store proof if verification fails', async () => {
      vi.mocked(reclaim.isProofAlreadyVerified).mockResolvedValue(false)
      vi.mocked(reclaim.verifyProof).mockResolvedValue({
        verified: false,
        reason: 'invalid-signature',
        details: { error: 'Signature mismatch' }
      } as any)

      const res = await request(app)
        .post('/zkp/verify')
        .send(validProof)

      expect(res.status).toBe(200)
      expect(res.body.verified).toBe(false)
      expect(prisma.user.upsert).not.toHaveBeenCalled()
      expect(prisma.proof.create).not.toHaveBeenCalled()
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
      expect(prisma.proof.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-test',
          gameId: 'game-1',
          provider: 'steam',
          verified: true,
          proofJson: { mock: true, inserted: true }
        }
      })
    })
  })
})