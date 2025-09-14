import { PrismaClient } from '@prisma/client'
import './config.js' // Ensure DATABASE_URL is set before Prisma initializes

export const prisma = new PrismaClient()

