import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  schema: z.any().optional()
});

const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  schema: z.any().optional()
});

// GET /api/categories - Get all item types (categories)
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.itemType.findMany({
      include: {
        _count: {
          select: {
            items: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/categories/:id - Get single item type (category) with items
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const category = await prisma.itemType.findUnique({
      where: { id: id },
      include: {
        items: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// POST /api/categories - Create new item type (category)
router.post('/', async (req, res) => {
  try {
    const validatedData = CreateCategorySchema.parse(req.body);

    const category = await prisma.itemType.create({
      data: validatedData
    });

    res.status(201).json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id - Update item type (category)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = UpdateCategorySchema.parse(req.body);

    const category = await prisma.itemType.update({
      where: { id: id },
      data: validatedData
    });

    res.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id - Delete item type (category)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category has items
    const category = await prisma.itemType.findUnique({
      where: { id: id },
      include: {
        _count: {
          select: {
            items: true
          }
        }
      }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (category._count.items > 0) {
      return res.status(400).json({
        error: 'Cannot delete category with existing items',
        itemCount: category._count.items
      });
    }

    await prisma.itemType.delete({
      where: { id: id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;