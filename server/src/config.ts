import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from parent directory (root of the project)
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// PostgreSQL configuration
const POSTGRES_USER = process.env.POSTGRES_USER || 'zksteam'
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'password123'
const POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost'
const POSTGRES_PORT = process.env.POSTGRES_PORT || '5432'
const POSTGRES_DB = process.env.POSTGRES_DB || 'zksteam_db'

// Construct DATABASE_URL from individual PostgreSQL variables if not directly provided
const DATABASE_URL = process.env.DATABASE_URL ||
  `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public`

// Set DATABASE_URL in process.env for Prisma to use
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DATABASE_URL
}

export const config = {
  database: {
    url: DATABASE_URL,
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    host: POSTGRES_HOST,
    port: parseInt(POSTGRES_PORT),
    name: POSTGRES_DB
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    corsOrigin: process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) || '*'
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
  },
  reclaim: {
    appId: process.env.RECLAIM_APP_ID || '',
    appSecret: process.env.RECLAIM_APP_SECRET || ''
  },
  zkp: {
    mock: process.env.ZKP_MOCK === 'true'
  }
}