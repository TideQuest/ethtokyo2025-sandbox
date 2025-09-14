import { Router } from 'express';
import { z } from 'zod';
import { CURATORS } from '../config/curators.js';
import { getCuratorRecommendation } from '../services/curatorService.js';

const router = Router();

// リクエストバリデーション用スキーマ
const RecommendRequestSchema = z.object({
  game: z.string().min(1, 'ゲーム名が必要です')
});

// GET /api/curators - キュレーター一覧取得
router.get('/', (req, res) => {
  try {
    res.json({
      ok: true,
      data: {
        curators: CURATORS
      }
    });
  } catch (error) {
    console.error('Error fetching curators:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to fetch curators' 
    });
  }
});

// POST /api/curators/:curatorId/recommend - キュレーター推薦
router.post('/:curatorId/recommend', async (req, res) => {
  try {
    const { curatorId } = req.params;
    
    // キュレーターIDの検証
    const curator = CURATORS.find(c => c.id === curatorId);
    if (!curator) {
      return res.status(400).json({
        ok: false,
        error: `Invalid curator ID: ${curatorId}`
      });
    }
    
    // リクエストボディの検証
    const parse = RecommendRequestSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid request body',
        details: parse.error.issues
      });
    }
    
    const { game } = parse.data;
    
    // キュレーター推薦を取得
    const result = await getCuratorRecommendation(curatorId, game);
    
    res.json({
      ok: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting curator recommendation:', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to get recommendation'
    });
  }
});

export default router;
