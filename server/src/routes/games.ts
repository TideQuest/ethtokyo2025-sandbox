import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const router = Router()
const prisma = new PrismaClient()

const CreateRecommendationSchema = z.object({
  sourceGameId: z.string(),
  targetGameId: z.string(),
  description: z.string(),
  walletAddress: z.string(),
})

const LikeSchema = z.object({
  walletAddress: z.string(),
})

// GET /api/games/:steamAppId - Get game details
router.get('/:steamAppId', async (req, res) => {
  try {
    const { steamAppId } = req.params

    const steamGame = await prisma.itemSteamGame.findUnique({
      where: { steamAppId },
      include: {
        item: true,
      },
    })

    if (!steamGame) {
      return res.status(404).json({ error: 'Game not found' })
    }

    const gameData = {
      id: steamGame.steamAppId,
      name: steamGame.gameName,
      description: (steamGame.item.metadata as any)?.description || '',
      genre: (steamGame.additionalData as any)?.genre || '',
      releaseDate: (steamGame.additionalData as any)?.releaseDate || '',
      developer: (steamGame.additionalData as any)?.developer || '',
      imageUrl: `https://steamcdn-a.akamaihd.net/steam/apps/${steamAppId}/header.jpg`,
    }

    res.json(gameData)
  } catch (error) {
    console.error('Error fetching game details:', error)
    res.status(500).json({ error: 'Failed to fetch game details' })
  }
})

// GET /api/games/:steamAppId/recommendations - Get recommendations for a game
router.get('/:steamAppId/recommendations', async (req, res) => {
  try {
    const { steamAppId } = req.params
    const { walletAddress } = req.query

    // Find the item ID for this Steam game
    const steamGame = await prisma.itemSteamGame.findFirst({
      where: { steamAppId },
    })

    if (!steamGame) {
      return res.status(404).json({ error: 'Game not found' })
    }

    // Get recommendations for this item
    const recommendations = await prisma.recommendResult.findMany({
      where: {
        recommendRequest: {
          itemId: steamGame.itemId,
        },
        status: 'active',
      },
      include: {
        item: true,
        recommenderAccount: {
          include: {
            accountType: true,
          },
        },
        _count: {
          select: {
            likes: {
              where: { isLiked: true },
            },
          },
        },
      },
      orderBy: [
        { rating: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    // Get current user's account if wallet address provided
    let currentAccount = null
    if (walletAddress) {
      currentAccount = await prisma.account.findUnique({
        where: { walletAddress: walletAddress as string },
      })
    }

    // Get all account IDs from recommendations
    const accountIds = recommendations.map(r => r.recommenderAccountId)

    // Get proofs for purchase history
    const proofs = await prisma.proof.findMany({
      where: {
        userId: { in: accountIds },
        status: 'verified',
      },
    })

    // Transform recommendations to match UI format
    const transformedRecommendations = await Promise.all(
      recommendations.map(async (rec) => {
        // Check if current user liked this recommendation
        let isLiked = false
        if (currentAccount) {
          const like = await prisma.recommendResultLike.findUnique({
            where: {
              recommendResultId_accountId: {
                recommendResultId: rec.id,
                accountId: currentAccount.id,
              },
            },
          })
          isLiked = like?.isLiked || false
        }

        // Check purchase history
        const userProofs = proofs.filter(p => p.userId === rec.recommenderAccountId)
        const hasSourceGame = userProofs.some(p =>
          (p.proofData as any)?.appId === steamAppId
        )
        const recommendedGameId = await prisma.itemSteamGame.findFirst({
          where: { itemId: rec.itemId },
          select: { steamAppId: true },
        })
        const hasRecommendedGame = userProofs.some(p =>
          (p.proofData as any)?.appId === recommendedGameId?.steamAppId
        )

        return {
          id: rec.id,
          name: rec.item.name,
          description: rec.recommendationText,
          accountType: rec.recommenderAccount.accountType.name === 'ai' ? 'ai' : rec.recommenderAccount.accountType.name === 'admin' ? 'admin' : 'user',
          accountName: rec.recommenderAccount.nickname || rec.recommenderAccount.walletAddress,
          purchaseHistory: rec.recommenderAccount.accountType.name === 'human' ? {
            hasSourceGame,
            hasRecommendedGame,
          } : undefined,
          likes: rec._count.likes,
          isLiked,
        }
      })
    )

    res.json(transformedRecommendations)
  } catch (error) {
    console.error('Error fetching recommendations:', error)
    res.status(500).json({ error: 'Failed to fetch recommendations' })
  }
})

// POST /api/games/recommendations - Create a new recommendation
router.post('/recommendations', async (req, res) => {
  try {
    const validatedData = CreateRecommendationSchema.parse(req.body)

    // Find account
    const account = await prisma.account.findUnique({
      where: { walletAddress: validatedData.walletAddress },
      include: { accountType: true },
    })

    if (!account) {
      return res.status(404).json({ error: 'Account not found' })
    }

    // Find source game item
    const sourceGame = await prisma.itemSteamGame.findFirst({
      where: { steamAppId: validatedData.sourceGameId },
    })

    if (!sourceGame) {
      return res.status(404).json({ error: 'Source game not found' })
    }

    // Find target game item
    const targetGame = await prisma.itemSteamGame.findFirst({
      where: { steamAppId: validatedData.targetGameId },
    })

    if (!targetGame) {
      return res.status(404).json({ error: 'Target game not found' })
    }

    // Create or find recommendation request
    let recommendRequest = await prisma.recommendRequest.findFirst({
      where: {
        itemId: sourceGame.itemId,
        status: 'pending',
      },
    })

    if (!recommendRequest) {
      recommendRequest = await prisma.recommendRequest.create({
        data: {
          itemId: sourceGame.itemId,
          requesterAccountId: account.id,
          status: 'pending',
          requestDetails: `Recommendations for Steam game ${validatedData.sourceGameId}`,
        },
      })
    }

    // Create recommendation result
    const recommendResult = await prisma.recommendResult.create({
      data: {
        itemId: targetGame.itemId,
        recommendRequestId: recommendRequest.id,
        recommenderAccountId: account.id,
        recommendationText: validatedData.description,
        status: 'active',
      },
    })

    res.status(201).json(recommendResult)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      })
    }
    console.error('Error creating recommendation:', error)
    res.status(500).json({ error: 'Failed to create recommendation' })
  }
})

// POST /api/recommendations/:id/like - Like a recommendation
router.post('/:id/like', async (req, res) => {
  try {
    const { id } = req.params
    const validatedData = LikeSchema.parse(req.body)

    // Find account
    const account = await prisma.account.findUnique({
      where: { walletAddress: validatedData.walletAddress },
    })

    if (!account) {
      return res.status(404).json({ error: 'Account not found' })
    }

    // Check if like already exists
    const existingLike = await prisma.recommendResultLike.findUnique({
      where: {
        recommendResultId_accountId: {
          recommendResultId: id,
          accountId: account.id,
        },
      },
    })

    if (existingLike) {
      // Toggle like status
      const updatedLike = await prisma.recommendResultLike.update({
        where: { id: existingLike.id },
        data: { isLiked: !existingLike.isLiked },
      })
      return res.json({ success: true, liked: updatedLike.isLiked })
    }

    // Create new like
    await prisma.recommendResultLike.create({
      data: {
        recommendResultId: id,
        accountId: account.id,
        isLiked: true,
      },
    })

    res.status(201).json({ success: true, liked: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      })
    }
    console.error('Error liking recommendation:', error)
    res.status(500).json({ error: 'Failed to like recommendation' })
  }
})

// DELETE /api/recommendations/:id/like - Unlike a recommendation
router.delete('/:id/like', async (req, res) => {
  try {
    const { id } = req.params
    const validatedData = LikeSchema.parse(req.body)

    // Find account
    const account = await prisma.account.findUnique({
      where: { walletAddress: validatedData.walletAddress },
    })

    if (!account) {
      return res.status(404).json({ error: 'Account not found' })
    }

    // Find existing like
    const existingLike = await prisma.recommendResultLike.findUnique({
      where: {
        recommendResultId_accountId: {
          recommendResultId: id,
          accountId: account.id,
        },
      },
    })

    if (!existingLike) {
      return res.status(404).json({ error: 'Like not found' })
    }

    // Update like status to false
    await prisma.recommendResultLike.update({
      where: { id: existingLike.id },
      data: { isLiked: false },
    })

    res.json({ success: true, liked: false })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      })
    }
    console.error('Error unliking recommendation:', error)
    res.status(500).json({ error: 'Failed to unlike recommendation' })
  }
})

export default router