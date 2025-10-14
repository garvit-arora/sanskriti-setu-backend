const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const path = require('path')
const helmet = require('helmet')
const compression = require('compression')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/users')
const culturalRoutes = require('./routes/cultural')
const matchRoutes = require('./routes/matches')
const chatRoutes = require('./routes/chat')

const app = express()

app.use(helmet())
app.use(compression())
app.use(morgan('combined'))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
})
app.use(limiter)

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

let mongoConnected = false
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sanskriti-setu', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
  .then(() => { mongoConnected = true })
  .catch(() => { mongoConnected = false })

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/cultural', culturalRoutes)
app.use('/api/matches', matchRoutes)
app.use('/api/chat', chatRoutes)

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: {
      connected: mongoose.connection.readyState === 1,
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    }
  })
})

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'))
  })
}

app.use((err, req, res, next) => {
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  })
})

app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

module.exports = app
