const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get user profile
router.get('/profile/:userId?', authMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    
    const user = await User.findById(userId)
      .select('-password')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Increment profile views if viewing another user's profile
    if (userId.toString() !== req.user._id.toString()) {
      await User.findByIdAndUpdate(userId, { 
        $inc: { 'activity.profileViews': 1 } 
      });
    }

    res.json({
      success: true,
      data: {
        user,
        profileCompletion: new User(user).calculateProfileCompletion()
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updateData.password;
    delete updateData.email;
    delete updateData._id;
    delete updateData.gamification;
    delete updateData.activity;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Award points for profile update
    await user.addPoints(5);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user,
        profileCompletion: user.calculateProfileCompletion()
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
});

// Add cultural content (festivals, traditions, cuisine)
router.post('/cultural-content', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { type, content } = req.body;

    if (!['festivals', 'traditions', 'cuisine'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid content type. Must be festivals, traditions, or cuisine'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add content to the appropriate array
    user.culturalProfile[type].push(content);
    await user.save();

    // Award points for sharing cultural content
    await user.addPoints(15);
    user.activity.culturalContentShared += 1;
    await user.save();

    res.json({
      success: true,
      message: `${type} added successfully`,
      data: {
        [type]: user.culturalProfile[type],
        pointsEarned: 15
      }
    });

  } catch (error) {
    console.error('Add cultural content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add cultural content'
    });
  }
});

// Get leaderboard
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const type = req.query.type || 'points'; // points, matches, cultural_content
    const limit = parseInt(req.query.limit) || 10;

    let sortCriteria = {};
    switch (type) {
      case 'points':
        sortCriteria = { 'gamification.points': -1 };
        break;
      case 'matches':
        sortCriteria = { 'activity.totalMatches': -1 };
        break;
      case 'cultural_content':
        sortCriteria = { 'activity.culturalContentShared': -1 };
        break;
      default:
        sortCriteria = { 'gamification.points': -1 };
    }

    const leaders = await User.find({ isActive: true })
      .select('name culturalProfile.state gamification.points gamification.level activity profilePicture')
      .sort(sortCriteria)
      .limit(limit)
      .lean();

    // Find current user's rank
    const currentUserRank = await User.countDocuments({
      isActive: true,
      [Object.keys(sortCriteria)[0]]: { 
        $gt: req.user[Object.keys(sortCriteria)[0].split('.')[0]][Object.keys(sortCriteria)[0].split('.')[1]] 
      }
    }) + 1;

    res.json({
      success: true,
      data: {
        leaderboard: leaders.map((user, index) => ({
          rank: index + 1,
          ...user
        })),
        currentUserRank,
        leaderboardType: type
      }
    });

  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard'
    });
  }
});

// Get user achievements and badges
router.get('/achievements', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    
    // Check for new achievements
    const achievements = await checkForNewAchievements(user);
    
    res.json({
      success: true,
      data: {
        currentLevel: user.gamification.level,
        totalPoints: user.gamification.points,
        badges: user.gamification.badges,
        achievements: user.gamification.achievements,
        newAchievements: achievements,
        streaks: user.gamification.streaks,
        activity: user.activity
      }
    });

  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch achievements'
    });
  }
});

// Search users by cultural interests
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { 
      state, 
      language, 
      culturalInterest, 
      artForm,
      limit = 20,
      page = 1 
    } = req.query;

    const searchCriteria = {
      _id: { $ne: req.user._id },
      isActive: true
    };

    if (state) {
      searchCriteria['culturalProfile.state'] = new RegExp(state, 'i');
    }

    if (language) {
      searchCriteria.$or = [
        { 'culturalProfile.primaryLanguages': new RegExp(language, 'i') },
        { 'culturalProfile.regionalLanguages': new RegExp(language, 'i') }
      ];
    }

    if (culturalInterest) {
      searchCriteria['culturalProfile.culturalInterests'] = new RegExp(culturalInterest, 'i');
    }

    if (artForm) {
      searchCriteria['culturalProfile.artForms'] = new RegExp(artForm, 'i');
    }

    const skip = (page - 1) * limit;
    
    const users = await User.find(searchCriteria)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalUsers = await User.countDocuments(searchCriteria);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalUsers,
          hasMore: (page * limit) < totalUsers
        }
      }
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users'
    });
  }
});

// Helper function to check for new achievements
async function checkForNewAchievements(user) {
  const newAchievements = [];
  const currentAchievements = user.gamification.achievements.map(a => a.type || a);

  // First Match Achievement
  if (user.activity.totalMatches >= 1 && !currentAchievements.includes('first_match')) {
    newAchievements.push({
      type: 'first_match',
      name: 'First Connection',
      description: 'Made your first cultural match!',
      points: 50
    });
  }

  // Cultural Ambassador (5 matches)
  if (user.activity.totalMatches >= 5 && !currentAchievements.includes('cultural_ambassador')) {
    newAchievements.push({
      type: 'cultural_ambassador',
      name: 'Cultural Ambassador',
      description: 'Connected with 5 people from different cultures!',
      points: 100
    });
  }

  // Content Creator (shared 10 cultural items)
  if (user.activity.culturalContentShared >= 10 && !currentAchievements.includes('content_creator')) {
    newAchievements.push({
      type: 'content_creator',
      name: 'Content Creator',
      description: 'Shared 10 cultural traditions, festivals, or recipes!',
      points: 75
    });
  }

  // Week Streak
  if (user.gamification.streaks.current >= 7 && !currentAchievements.includes('week_streak')) {
    newAchievements.push({
      type: 'week_streak',
      name: 'Dedicated Learner',
      description: 'Logged in for 7 consecutive days!',
      points: 100
    });
  }

  // Save new achievements
  if (newAchievements.length > 0) {
    user.gamification.achievements.push(...newAchievements.map(a => ({
      type: a.type,
      earnedAt: new Date()
    })));
    
    const totalPoints = newAchievements.reduce((sum, a) => sum + a.points, 0);
    await user.addPoints(totalPoints);
  }

  return newAchievements;
}

module.exports = router;
