// Simple test server to debug Render deployment
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  credentials: false
}));

app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Sanskriti Setu Backend is running!',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    message: 'Simple test server working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test auth endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (email === 'demo@sanskriti.com' && password === 'demo123') {
    res.json({
      success: true,
      data: {
        token: 'test-token',
        user: {
          _id: 'demo-user-id',
          name: 'SIH Demo User',
          email: 'demo@sanskriti.com',
          culturalProfile: {
            state: 'Maharashtra',
            city: 'Mumbai',
            primaryLanguages: ['Hindi', 'Marathi'],
            bio: 'Demo user for SIH 2024'
          },
          gamification: {
            points: 1250,
            level: 3
          }
        }
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials. Use demo@sanskriti.com / demo123'
    });
  }
});

// Get current user
app.get('/api/auth/me', (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        _id: 'demo-user-id',
        name: 'SIH Demo User',
        email: 'demo@sanskriti.com',
        culturalProfile: {
          state: 'Maharashtra',
          city: 'Mumbai',
          primaryLanguages: ['Hindi', 'Marathi'],
          bio: 'Demo user for SIH 2024'
        },
        gamification: {
          points: 1250,
          level: 3
        }
      }
    }
  });
});

// Catch all 404s
app.use('*', (req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🎯 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
