import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { nl2sqlRouter } from './routes/nl2sql.js'
import { zkpRouter } from './routes/zkp.js'
import itemsRouter from './routes/items.js'
import recommendationsRouter from './routes/recommendations.js'
import categoriesRouter from './routes/categories.js'
import curatorsRouter from './routes/curators.js'

const app = express()

app.use(express.json({ limit: '2mb' }))
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) || '*',
    credentials: true
  })
)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})

app.use('/api/nl2sql', nl2sqlRouter)
app.use('/api/zkp', zkpRouter)
app.use('/api/items', itemsRouter)
app.use('/api/recommendations', recommendationsRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/curators', curatorsRouter)

const port = Number(process.env.PORT || 3000)
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`)
})

