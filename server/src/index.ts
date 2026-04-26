import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import applicationRoutes from './routes/applications.js'
import controlRoutes from './routes/controls.js'
import assessmentRoutes from './routes/assessments.js'
import riskRoutes from './routes/risks.js'
import dashboardRoutes from './routes/dashboard.js'

dotenv.config()

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173'],
  credentials: true,
}))
app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/applications', applicationRoutes)
app.use('/api/controls', controlRoutes)
app.use('/api/assessments', assessmentRoutes)
app.use('/api/risks', riskRoutes)
app.use('/api/dashboard', dashboardRoutes)

// Start server
app.listen(PORT, () => {
  console.log(`[IDVIZE API] Server running on http://localhost:${PORT}`)
  console.log(`[IDVIZE API] Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app
