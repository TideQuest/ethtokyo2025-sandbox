import { Router } from 'express';
import { z } from 'zod';
import { CURATORS } from '../config/curators.js';
import { getCuratorRecommendation } from '../services/curatorService.js';

const router = Router();

const RecommendationRequestSchema = z.object({
  game: z.string().min(1).max(200)
});

// GET /api/curators - Get list of available curators
router.get('/', (req, res) => {
  res.json(CURATORS);
});

// GET /api/curators/:curatorId - Get specific curator info
router.get('/:curatorId', (req, res) => {
  const { curatorId } = req.params;
  const curator = CURATORS.find(c => c.id === curatorId);

  if (!curator) {
    return res.status(404).json({ error: 'Curator not found' });
  }

  res.json(curator);
});

// POST /api/curators/:curatorId/recommend - Get game recommendations from a curator
router.post('/:curatorId/recommend', async (req, res) => {
  try {
    const { curatorId } = req.params;
    const validatedData = RecommendationRequestSchema.parse(req.body);

    const curator = CURATORS.find(c => c.id === curatorId);
    if (!curator) {
      return res.status(404).json({ error: 'Curator not found' });
    }

    const recommendation = await getCuratorRecommendation(
      curatorId,
      validatedData.game
    );

    res.json({
      ...recommendation,
      curatorInfo: curator
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Error getting curator recommendations:', error);
    res.status(500).json({ error: 'Failed to get curator recommendations' });
  }
});

export default router;
