import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod';

// NOTE: Updated to match current Prisma schema (Item IDs are strings; games via ItemSteamGame)

const router = Router()
const prisma = new PrismaClient()

// GET /api/items - List items (games) with Steam details

const CreateItemSchema = z.object({
  name: z.string().min(1).max(255),
  itemTypeId: z.string().uuid(),
  metadata: z.any().optional()
});

const UpdateItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  itemTypeId: z.string().uuid().optional(),
  metadata: z.any().optional()
});

// GET /api/items - Get all items
router.get('/', async (req, res) => {
  try {
    const { itemTypeId } = req.query;

    const where = itemTypeId
      ? { itemTypeId: itemTypeId as string }
      : {};

    const items = await prisma.item.findMany({
      include: {
        itemType: true,
        steamGameDetails: true,
        _count: {
          select: {
            recommendResults: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(items)
  } catch (error) {
    console.error('Error fetching items:', error)
    res.status(500).json({ error: 'Failed to fetch items' })
  }
})

// GET /api/items/:id - Get single item
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const item = await prisma.item.findUnique({
      where: { id: id },
      include: {
        itemType: true,
        steamGameDetails: true,
        recommendResults: true
      }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// POST /api/items - Create new item
router.post('/', async (req, res) => {
  try {
    const validatedData = CreateItemSchema.parse(req.body);

    const item = await prisma.item.create({
      data: validatedData,
      include: {
        itemType: true
      }
    });

    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PUT /api/items/:id - Update item
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = UpdateItemSchema.parse(req.body);

    const item = await prisma.item.update({
      where: { id: id },
      data: validatedData,
      include: {
        itemType: true
      }
    });

    res.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/items/:id - Delete item
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.item.delete({
      where: { id: id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;
