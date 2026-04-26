import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
})

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err)
})

export default pool
