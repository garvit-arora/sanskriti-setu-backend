const express = require('express');
const User = require('../models/User');
const Match = require('../models/Match');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get potential matches for user
router.get('/discover', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    // Get user's preferences
    const currentUser = await User.findById(userId);
    
    // Find users that the current user hasn't already matched with
    const existingMatches = await Match.find({
      $or: [
        { user1: userId },
        { user2: userId }
      ]
    }).select('user1 user2');

    const matchedUserIds = existingMatches.flatMap(match => 
      [match.user1.toString(), match.user2.toString()]
    ).filter(id => id !== userId.toString());

    // Build match criteria
    const matchCriteria = {
      _id: { $ne: userId, $nin: matchedUserIds },
      isActive: true
    };

    // Add state preferences if specified
    if (currentUser.learningPreferences.interestedStates.length > 0) {
      matchCriteria['culturalProfile.state'] = {
        $in: currentUser.learningPreferences.interestedStates
      };
    }

    // Find potential matches
    const potentialMatches = await User.find(matchCriteria)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .lean();

    // Calculate match scores for each potential match
    const matchesWithScores = await Promise.all(
      potentialMatches.map(async (potentialMatch) => {
        const matchData = calculateMatchCompatibility(currentUser, potentialMatch);
        
        return {
          user: potentialMatch,
          matchScore: matchData.score,
          matchReasons: matchData.reasons,
          commonInterests: matchData.commonInterests,
          culturalBridge: {
            yourState: currentUser.culturalProfile.state,
            theirState: potentialMatch.culturalProfile.state,
            sharedLanguages: matchData.sharedLanguages
          }
        };
      })
    );

    // Sort by match score
    matchesWithScores.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      success: true,
      data: {
        matches: matchesWithScores,
        pagination: {
          page,
          limit,
          hasMore: matchesWithScores.length === limit
        }
      }
    });

  } catch (error) {
    console.error('Discover matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch matches'
    });
  }
});

// Like/Pass on a user
router.post('/action', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { targetUserId, action } = req.body;

    if (!['like', 'pass', 'super_like'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be like, pass, or super_like'
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found'
      });
    }

    // Check if match already exists
    let match = await Match.areUsersMatched(userId, targetUserId);
    
    if (match) {
      // Update existing match
      await match.updateUserAction(userId, action);
    } else if (action !== 'pass') {
      // Create new match for likes and super likes
      const currentUser = await User.findById(userId);
      const matchData = calculateMatchCompatibility(currentUser, targetUser);
      
      match = new Match({
        user1: userId,
        user2: targetUserId,
        matchScore: matchData.score,
        matchCriteria: {
          commonInterests: matchData.commonInterests,
          complementarySkills: {
            user1Teaches: currentUser.learningPreferences.teachingSkills,
            user2Teaches: targetUser.learningPreferences.teachingSkills,
            user1Learns: currentUser.learningPreferences.learningGoals,
            user2Learns: targetUser.learningPreferences.learningGoals
          },
          culturalBridge: {
            user1State: currentUser.culturalProfile.state,
            user2State: targetUser.culturalProfile.state,
            sharedLanguages: matchData.sharedLanguages,
            culturalSimilarities: matchData.culturalSimilarities
          }
        }
      });
      
      await match.updateUserAction(userId, action);
    }

    // Add points for interaction
    await req.user.addPoints(action === 'super_like' ? 5 : 2);

    // Check if it's a mutual match
    let isMutualMatch = false;
    if (match && match.status === 'accepted') {
      isMutualMatch = true;
      
      // Award bonus points for mutual match
      await User.findByIdAndUpdate(userId, { $inc: { 'gamification.points': 20 } });
      await User.findByIdAndUpdate(targetUserId, { $inc: { 'gamification.points': 20 } });
      
      // Update activity counters
      await User.findByIdAndUpdate(userId, { $inc: { 'activity.totalMatches': 1 } });
      await User.findByIdAndUpdate(targetUserId, { $inc: { 'activity.totalMatches': 1 } });
    }

    res.json({
      success: true,
      data: {
        action,
        isMutualMatch,
        matchId: match ? match._id : null,
        message: isMutualMatch ? 
          'It\'s a match! You can now start chatting.' : 
          `You ${action}d this person.`
      }
    });

  } catch (error) {
    console.error('Match action error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process match action'
    });
  }
});

// Get user's matches
router.get('/my-matches', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const status = req.query.status || 'accepted';
    
    const matches = await Match.find({
      $or: [
        { user1: userId },
        { user2: userId }
      ],
      status: status,
      isActive: true
    })
    .populate('user1 user2', '-password')
    .sort({ lastInteraction: -1 })
    .lean();

    // Format matches to show the other user
    const formattedMatches = matches.map(match => {
      const isUser1 = match.user1._id.toString() === userId.toString();
      const otherUser = isUser1 ? match.user2 : match.user1;
      
      return {
        matchId: match._id,
        user: otherUser,
        matchScore: match.matchScore,
        matchedAt: match.createdAt,
        lastInteraction: match.lastInteraction,
        chatStarted: match.chatStarted,
        chatId: match.chatId,
        culturalExchange: match.culturalExchange,
        commonInterests: match.matchCriteria.commonInterests,
        complementarySkills: {
          theyTeach: isUser1 ? 
            match.matchCriteria.complementarySkills.user2Teaches :
            match.matchCriteria.complementarySkills.user1Teaches,
          theyLearn: isUser1 ? 
            match.matchCriteria.complementarySkills.user2Learns :
            match.matchCriteria.complementarySkills.user1Learns
        }
      };
    });

    res.json({
      success: true,
      data: {
        matches: formattedMatches,
        total: formattedMatches.length
      }
    });

  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch matches'
    });
  }
});

// Get match statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const stats = await Match.aggregate([
      {
        $match: {
          $or: [
            { user1: userId },
            { user2: userId }
          ],
          isActive: true
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const formattedStats = {
      totalMatches: 0,
      accepted: 0,
      pending: 0,
      declined: 0
    };

    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
      formattedStats.totalMatches += stat.count;
    });

    // Get cultural exchange stats
    const culturalStats = await Match.aggregate([
      {
        $match: {
          $or: [
            { user1: userId },
            { user2: userId }
          ],
          status: 'accepted',
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          totalRecipesShared: {
            $sum: {
              $add: [
                { $size: { $ifNull: ['$culturalExchange.recipesShared.user1ToUser2', []] } },
                { $size: { $ifNull: ['$culturalExchange.recipesShared.user2ToUser1', []] } }
              ]
            }
          },
          totalLanguageSessions: { $sum: '$culturalExchange.languageExchange.sessionsCompleted' },
          totalMeetups: {
            $sum: { $size: { $ifNull: ['$culturalExchange.meetupsPlanned', []] } }
          }
        }
      }
    ]);

    const culturalExchangeStats = culturalStats[0] || {
      totalRecipesShared: 0,
      totalLanguageSessions: 0,
      totalMeetups: 0
    };

    res.json({
      success: true,
      data: {
        matchStats: formattedStats,
        culturalExchangeStats
      }
    });

  } catch (error) {
    console.error('Get match stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch match statistics'
    });
  }
});

// Helper function to calculate match compatibility
function calculateMatchCompatibility(user1, user2) {
  const score = {
    total: 0,
    reasons: [],
    commonInterests: [],
    sharedLanguages: [],
    culturalSimilarities: []
  };

  // 1. Cultural Interests Compatibility (25 points)
  const commonCulturalInterests = user1.culturalProfile.culturalInterests.filter(
    interest => user2.culturalProfile.culturalInterests.includes(interest)
  );
  if (commonCulturalInterests.length > 0) {
    const points = Math.min(commonCulturalInterests.length * 5, 25);
    score.total += points;
    score.commonInterests = commonCulturalInterests;
    score.reasons.push(`${commonCulturalInterests.length} shared cultural interests`);
  }

  // 2. Language Compatibility (20 points)
  const sharedLanguages = user1.culturalProfile.primaryLanguages.filter(
    lang => user2.culturalProfile.primaryLanguages.includes(lang) ||
            user2.culturalProfile.regionalLanguages.includes(lang)
  );
  if (sharedLanguages.length > 0) {
    const points = Math.min(sharedLanguages.length * 10, 20);
    score.total += points;
    score.sharedLanguages = sharedLanguages;
    score.reasons.push(`Can communicate in ${sharedLanguages.join(', ')}`);
  }

  // 3. Learning-Teaching Compatibility (30 points)
  const teachingMatches = user1.learningPreferences.teachingSkills.filter(
    skill => user2.learningPreferences.learningGoals.includes(skill)
  );
  const reverseTeachingMatches = user2.learningPreferences.teachingSkills.filter(
    skill => user1.learningPreferences.learningGoals.includes(skill)
  );
  
  if (teachingMatches.length > 0 || reverseTeachingMatches.length > 0) {
    const points = Math.min((teachingMatches.length + reverseTeachingMatches.length) * 10, 30);
    score.total += points;
    score.reasons.push('Complementary learning and teaching skills');
  }

  // 4. Geographic Diversity Bonus (15 points)
  if (user1.culturalProfile.state !== user2.culturalProfile.state) {
    score.total += 15;
    score.reasons.push('Cultural exchange between different states');
  }

  // 5. Art Forms Compatibility (10 points)
  const commonArtForms = user1.culturalProfile.artForms.filter(
    art => user2.culturalProfile.artForms.includes(art)
  );
  if (commonArtForms.length > 0) {
    score.total += 10;
    score.culturalSimilarities.push(...commonArtForms);
    score.reasons.push(`Shared interest in ${commonArtForms.join(', ')}`);
  }

  return {
    score: Math.min(score.total, 100),
    reasons: score.reasons,
    commonInterests: score.commonInterests,
    sharedLanguages: score.sharedLanguages,
    culturalSimilarities: score.culturalSimilarities
  };
}

module.exports = router;
