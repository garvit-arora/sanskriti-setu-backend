const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// JWT Secret (in production, this should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

// Register new user
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      age,
      gender,
      culturalProfile
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !age || !gender || !culturalProfile) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create new user
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      age,
      gender,
      culturalProfile: {
        state: culturalProfile.state,
        city: culturalProfile.city,
        primaryLanguages: culturalProfile.primaryLanguages || [],
        regionalLanguages: culturalProfile.regionalLanguages || [],
        bio: culturalProfile.bio || '',
        festivals: culturalProfile.festivals || [],
        traditions: culturalProfile.traditions || [],
        cuisine: culturalProfile.cuisine || [],
        artForms: culturalProfile.artForms || [],
        culturalInterests: culturalProfile.culturalInterests || []
      },
      learningPreferences: {
        interestedStates: req.body.learningPreferences?.interestedStates || [],
        learningGoals: req.body.learningPreferences?.learningGoals || [],
        teachingSkills: req.body.learningPreferences?.teachingSkills || []
      }
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Add welcome points
    await user.addPoints(50);

    // Return user data (excluding password)
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token,
        profileCompletion: user.calculateProfileCompletion()
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }

    // Update last seen
    await user.updateLastSeen();

    // Add daily login points
    const today = new Date().toDateString();
    const lastLoginDate = user.gamification.streaks.lastActive ? 
      user.gamification.streaks.lastActive.toDateString() : null;
    
    if (lastLoginDate !== today) {
      if (lastLoginDate === new Date(Date.now() - 24*60*60*1000).toDateString()) {
        // Consecutive day login
        user.gamification.streaks.current += 1;
        user.gamification.streaks.longest = Math.max(
          user.gamification.streaks.longest,
          user.gamification.streaks.current
        );
      } else {
        // Reset streak
        user.gamification.streaks.current = 1;
      }
      
      user.gamification.streaks.lastActive = new Date();
      await user.addPoints(10); // Daily login bonus
    }

    // Generate token
    const token = generateToken(user._id);

    // Return user data (excluding password)
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token,
        profileCompletion: user.calculateProfileCompletion()
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
});

// Get current user (protected route)
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user,
        profileCompletion: user.calculateProfileCompletion()
      }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user data'
    });
  }
});

// Refresh token
router.post('/refresh-token', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token is required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    const newToken = generateToken(user._id);
    
    res.json({
      success: true,
      data: { token: newToken }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// Logout (client-side token removal, server can implement token blacklisting)
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;
