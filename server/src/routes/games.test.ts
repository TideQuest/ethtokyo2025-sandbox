import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { PrismaClient } from '@prisma/client'
import gamesRouter from './games.js'

vi.mock('@prisma/client', () => {
  const mockPrismaClient = {
    itemSteamGame: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    item: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    recommendRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    recommendResult: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    recommendResultLike: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    account: {
      findUnique: vi.fn(),
    },
    accountType: {
      findUnique: vi.fn(),
    },
    proof: {
      findMany: vi.fn(),
    },
  }
  return {
    PrismaClient: vi.fn(() => mockPrismaClient),
  }
})

describe('Games Router', () => {
  let app: express.Application
  let prisma: any

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api/games', gamesRouter)
    prisma = new PrismaClient()
    vi.clearAllMocks()
  })

  describe('GET /api/games/:steamAppId', () => {
    it('should return game details when game exists', async () => {
      const mockGame = {
        steamAppId: '730',
        itemId: 'item-1',
        gameName: 'Counter-Strike: Global Offensive',
        storeUrl: 'https://store.steampowered.com/app/730',
        additionalData: {
          genre: 'Action, FPS',
          releaseDate: '2012-08-21',
          developer: 'Valve Corporation',
        },
        item: {
          id: 'item-1',
          name: 'Counter-Strike: Global Offensive',
          metadata: {
            description: 'CS:GO expands upon the team-based action gameplay',
          },
        },
      }

      prisma.itemSteamGame.findUnique.mockResolvedValue(mockGame)

      const response = await request(app)
        .get('/api/games/730')
        .expect(200)

      expect(response.body).toEqual({
        id: '730',
        name: 'Counter-Strike: Global Offensive',
        description: 'CS:GO expands upon the team-based action gameplay',
        genre: 'Action, FPS',
        releaseDate: '2012-08-21',
        developer: 'Valve Corporation',
        imageUrl: 'https://steamcdn-a.akamaihd.net/steam/apps/730/header.jpg',
      })
    })

    it('should return 404 when game does not exist', async () => {
      prisma.itemSteamGame.findUnique.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/games/999999')
        .expect(404)

      expect(response.body).toEqual({
        error: 'Game not found',
      })
    })
  })

  describe('GET /api/games/:steamAppId/recommendations', () => {
    it('should return recommendations with account info and likes', async () => {
      const mockRecommendations = [
        {
          id: 'rec-1',
          recommendationText: 'Similar tactical FPS gameplay',
          recommenderAccount: {
            id: 'acc-1',
            nickname: 'FPS Recommender AI',
            accountType: {
              name: 'ai',
            },
          },
          item: {
            id: 'item-2',
            name: 'Counter-Strike 2',
            metadata: {},
          },
          _count: {
            likes: 47,
          },
        },
        {
          id: 'rec-2',
          recommendationText: 'Same competitive shooter genre',
          recommenderAccount: {
            id: 'acc-2',
            nickname: 'ProGamer_2024',
            accountType: {
              name: 'human',
            },
          },
          item: {
            id: 'item-3',
            name: 'Valorant',
            metadata: {},
          },
          _count: {
            likes: 23,
          },
        },
      ]

      prisma.itemSteamGame.findFirst.mockResolvedValue({
        itemId: 'item-1',
      })
      prisma.recommendResult.findMany.mockResolvedValue(mockRecommendations)
      prisma.recommendResultLike.findUnique.mockResolvedValue(null)
      prisma.proof.findMany.mockResolvedValue([])

      const response = await request(app)
        .get('/api/games/730/recommendations')
        .expect(200)

      expect(response.body).toHaveLength(2)
      expect(response.body[0]).toMatchObject({
        id: 'rec-1',
        name: 'Counter-Strike 2',
        description: 'Similar tactical FPS gameplay',
        accountType: 'ai',
        accountName: 'FPS Recommender AI',
        likes: 47,
        isLiked: false,
      })
    })

    it('should include purchase history when proofs exist', async () => {
      const mockRecommendations = [
        {
          id: 'rec-1',
          recommendationText: 'Great game',
          recommenderAccountId: 'acc-1',
          recommenderAccount: {
            id: 'acc-1',
            nickname: 'User123',
            accountType: {
              name: 'human',
            },
          },
          item: {
            id: 'item-2',
            name: 'Game 2',
            metadata: {},
          },
          _count: {
            likes: 10,
          },
        },
      ]

      const mockProofs = [
        {
          userId: 'acc-1',
          proofData: {
            appId: '730',
          },
        },
        {
          userId: 'acc-1',
          proofData: {
            appId: '570',
          },
        },
      ]

      prisma.itemSteamGame.findFirst.mockResolvedValue({
        itemId: 'item-1',
        steamAppId: '730',
      })
      prisma.recommendResult.findMany.mockResolvedValue(mockRecommendations)
      prisma.recommendResultLike.findUnique.mockResolvedValue(null)
      prisma.proof.findMany.mockResolvedValue(mockProofs)

      const response = await request(app)
        .get('/api/games/730/recommendations')
        .expect(200)

      expect(response.body[0]).toMatchObject({
        purchaseHistory: {
          hasSourceGame: true,
          hasRecommendedGame: true,
        },
      })
    })
  })

  describe('POST /api/games/recommendations', () => {
    it('should create a new recommendation', async () => {
      const mockAccount = {
        id: 'acc-1',
        walletAddress: '0x123',
        accountType: {
          name: 'human',
        },
      }

      prisma.account.findUnique.mockResolvedValue(mockAccount)
      prisma.itemSteamGame.findFirst
        .mockResolvedValueOnce({ itemId: 'item-1' })
        .mockResolvedValueOnce({ itemId: 'item-2' })
      prisma.recommendRequest.findFirst.mockResolvedValue(null)
      prisma.recommendRequest.create.mockResolvedValue({
        id: 'req-1',
        itemId: 'item-1',
        requesterAccountId: 'acc-1',
      })
      prisma.recommendResult.create.mockResolvedValue({
        id: 'new-rec',
        recommendationText: 'Test recommendation',
      })

      const response = await request(app)
        .post('/api/games/recommendations')
        .send({
          sourceGameId: '730',
          targetGameId: '570',
          description: 'Test recommendation',
          walletAddress: '0x123',
        })
        .expect(201)

      expect(response.body).toMatchObject({
        id: 'new-rec',
        recommendationText: 'Test recommendation',
      })
    })

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/games/recommendations')
        .send({
          sourceGameId: '730',
        })
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /api/recommendations/:id/like', () => {
    it('should create a like for a recommendation', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
      })
      prisma.recommendResultLike.findUnique.mockResolvedValue(null)
      prisma.recommendResultLike.create.mockResolvedValue({
        id: 'like-1',
        isLiked: true,
      })

      const response = await request(app)
        .post('/api/games/rec-1/like')
        .send({
          walletAddress: '0x123',
        })
        .expect(201)

      expect(response.body).toMatchObject({
        success: true,
        liked: true,
      })
    })

    it('should toggle existing like', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
      })
      prisma.recommendResultLike.findUnique.mockResolvedValue({
        id: 'like-1',
        isLiked: false,
      })
      prisma.recommendResultLike.update.mockResolvedValue({
        id: 'like-1',
        isLiked: true,
      })

      const response = await request(app)
        .post('/api/games/rec-1/like')
        .send({
          walletAddress: '0x123',
        })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        liked: true,
      })
    })
  })

  describe('DELETE /api/recommendations/:id/like', () => {
    it('should remove a like from a recommendation', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
      })
      prisma.recommendResultLike.findUnique.mockResolvedValue({
        id: 'like-1',
        isLiked: true,
      })
      prisma.recommendResultLike.update.mockResolvedValue({
        id: 'like-1',
        isLiked: false,
      })

      const response = await request(app)
        .delete('/api/games/rec-1/like')
        .send({
          walletAddress: '0x123',
        })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        liked: false,
      })
    })

    it('should return 404 when like does not exist', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
      })
      prisma.recommendResultLike.findUnique.mockResolvedValue(null)

      const response = await request(app)
        .delete('/api/games/rec-1/like')
        .send({
          walletAddress: '0x123',
        })
        .expect(404)

      expect(response.body).toHaveProperty('error', 'Like not found')
    })
  })
})