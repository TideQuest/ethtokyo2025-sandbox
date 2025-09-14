import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createProofRequest,
  verifyProof,
  isProofAlreadyVerified,
  ProofInput,
  ProofRequestResult,
  VerificationResult
} from './reclaim'

// Mock environment variables
vi.stubEnv('ZKP_MOCK', 'true')

describe('Reclaim Protocol', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createProofRequest', () => {
    it('should create mock proof request when ZKP_MOCK is true', async () => {
      const result = await createProofRequest({
        providerId: 'test-provider'
      })

      expect(result.mode).toBe('mock')
      expect(result.requestUrl).toBe('https://reclaim.example/mock')
      expect(result.sessionId).toMatch(/^mock-session-/)
      expect(result.expiresAt).toBeGreaterThan(Date.now())
    })

    it('should create mock proof request when no providerId', async () => {
      const result = await createProofRequest({})

      expect(result.mode).toBe('mock')
      expect(result.sessionId).toMatch(/^mock-session-/)
    })

    it('should handle context parameter', async () => {
      const result = await createProofRequest({
        providerId: 'test-provider',
        context: { userId: '123', game: 'cs2' }
      })

      expect(result).toBeDefined()
      expect(result.mode).toBe('mock')
    })

    it('should include expiration time', async () => {
      const result = await createProofRequest({
        providerId: 'test-provider'
      })

      expect(result.expiresAt).toBeDefined()
      expect(result.expiresAt).toBeGreaterThan(Date.now())
      expect(result.expiresAt).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000)
    })
  })

  describe('verifyProof', () => {
    it('should reject proof with missing payload', async () => {
      const proof: ProofInput = {
        provider: 'steam',
        payload: undefined
      }

      const result = await verifyProof(proof)

      expect(result.verified).toBe(false)
      expect(result.reason).toBe('missing-payload')
      expect(result.details?.error).toBe('Proof payload is required')
    })

    it('should verify mock proof successfully', async () => {
      const proof: ProofInput = {
        sessionId: 'test-session',
        provider: 'steam',
        payload: { mock: true, data: 'test' }
      }

      // Mock Math.random to ensure success
      vi.spyOn(Math, 'random').mockReturnValue(0.5)

      const result = await verifyProof(proof)

      expect(result.verified).toBe(true)
      expect(result.reason).toBe('mock-verified')
      expect(result.details?.sessionId).toBe('test-session')
      expect(result.details?.provider).toBe('steam')
      expect(result.details?.timestamp).toBeDefined()
    })

    it('should handle mock verification failure', async () => {
      const proof: ProofInput = {
        sessionId: 'test-session',
        provider: 'steam',
        payload: { mock: true }
      }

      // Mock Math.random to ensure failure
      vi.spyOn(Math, 'random').mockReturnValue(0.05)

      const result = await verifyProof(proof)

      expect(result.verified).toBe(false)
      expect(result.reason).toBe('mock-rejected')
      expect(result.details?.sessionId).toBe('test-session')
    })

    it('should include verification details in response', async () => {
      const proof: ProofInput = {
        sessionId: 'session-123',
        provider: 'epic',
        payload: { test: 'data' }
      }

      vi.spyOn(Math, 'random').mockReturnValue(0.9)

      const result = await verifyProof(proof)

      expect(result.details).toBeDefined()
      expect(result.details?.timestamp).toBeGreaterThan(0)
      expect(result.details?.provider).toBe('epic')
      expect(result.details?.sessionId).toBe('session-123')
    })

    describe('with real SDK (ZKP_MOCK=false)', () => {
      beforeEach(() => {
        // Set environment to false for real SDK testing
        process.env.ZKP_MOCK = 'false'
      })

      it('should handle SDK verification error gracefully', async () => {
        // Mock the SDK import to throw an error
        vi.doMock('@reclaimprotocol/js-sdk', () => ({
          verifyProof: vi.fn().mockRejectedValue(new Error('SDK Error'))
        }))

        const proof: ProofInput = {
          sessionId: 'test',
          provider: 'steam',
          payload: { data: 'test' }
        }

        const result = await verifyProof(proof)

        expect(result.verified).toBe(false)
        expect(result.reason).toBe('verification-error')
        expect(result.details?.error).toBe('SDK Error')
      })

      it('should handle SDK returning false', async () => {
        // Mock the SDK import
        vi.doMock('@reclaimprotocol/js-sdk', () => ({
          verifyProof: vi.fn().mockResolvedValue(false)
        }))

        const proof: ProofInput = {
          provider: 'steam',
          payload: { data: 'invalid' }
        }

        const result = await verifyProof(proof)

        expect(result.verified).toBe(false)
        expect(result.reason).toBe('invalid-proof')
      })

      it('should handle SDK returning true', async () => {
        // Mock the SDK import
        vi.doMock('@reclaimprotocol/js-sdk', () => ({
          verifyProof: vi.fn().mockResolvedValue(true)
        }))

        const proof: ProofInput = {
          sessionId: 'valid-session',
          provider: 'steam',
          payload: { data: 'valid' }
        }

        const result = await verifyProof(proof)

        expect(result.verified).toBe(true)
        expect(result.reason).toBe('verified')
        expect(result.details?.sessionId).toBe('valid-session')
      })
    })
  })

  describe('isProofAlreadyVerified', () => {
    it('should return false when sessionId is empty', async () => {
      const mockGetter = vi.fn()
      const result = await isProofAlreadyVerified('', mockGetter)

      expect(result).toBe(false)
      expect(mockGetter).not.toHaveBeenCalled()
    })

    it('should return false when no existing proof found', async () => {
      const mockGetter = vi.fn().mockResolvedValue(null)
      const result = await isProofAlreadyVerified('session-123', mockGetter)

      expect(result).toBe(false)
      expect(mockGetter).toHaveBeenCalledWith('session-123')
    })

    it('should return true when existing proof found', async () => {
      const mockGetter = vi.fn().mockResolvedValue({ id: 'proof-1', sessionId: 'session-123' })
      const result = await isProofAlreadyVerified('session-123', mockGetter)

      expect(result).toBe(true)
      expect(mockGetter).toHaveBeenCalledWith('session-123')
    })

    it('should handle database errors gracefully', async () => {
      const mockGetter = vi.fn().mockRejectedValue(new Error('DB Error'))
      const result = await isProofAlreadyVerified('session-123', mockGetter)

      expect(result).toBe(false)
      expect(mockGetter).toHaveBeenCalledWith('session-123')
    })
  })

  describe('Type definitions', () => {
    it('should have correct ProofInput type', () => {
      const proof: ProofInput = {
        sessionId: 'optional-session',
        provider: 'steam',
        payload: { any: 'data', nested: { value: 123 } }
      }

      expect(proof.provider).toBe('steam')
      expect(proof.sessionId).toBeDefined()
    })

    it('should have correct VerificationResult type', () => {
      const result: VerificationResult = {
        verified: true,
        reason: 'test-reason',
        details: {
          timestamp: Date.now(),
          provider: 'steam',
          sessionId: 'test',
          error: undefined
        }
      }

      expect(result.verified).toBe(true)
      expect(result.details).toBeDefined()
    })

    it('should have correct ProofRequestResult type', () => {
      const request: ProofRequestResult = {
        mode: 'mock',
        requestUrl: 'https://example.com',
        sessionId: 'session-123',
        expiresAt: Date.now() + 60000
      }

      expect(request.mode).toBe('mock')
      expect(request.expiresAt).toBeDefined()
    })
  })
})