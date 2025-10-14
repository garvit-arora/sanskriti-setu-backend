const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  user1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Match Details
  matchType: {
    type: String,
    enum: ['mutual_like', 'system_suggestion', 'cultural_interest', 'event_based'],
    default: 'system_suggestion'
  },
  
  matchScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  
  matchCriteria: {
    commonInterests: [String],
    complementarySkills: {
      user1Teaches: [String],
      user2Teaches: [String],
      user1Learns: [String],
      user2Learns: [String]
    },
    culturalBridge: {
      user1State: String,
      user2State: String,
      sharedLanguages: [String],
      culturalSimilarities: [String]
    }
  },
  
  // Interaction Status
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'blocked', 'expired'],
    default: 'pending'
  },
  
  interactions: {
    user1Action: {
      type: String,
      enum: ['like', 'pass', 'super_like', 'pending'],
      default: 'pending'
    },
    user2Action: {
      type: String,
      enum: ['like', 'pass', 'super_like', 'pending'],
      default: 'pending'
    },
    user1ActionDate: Date,
    user2ActionDate: Date
  },
  
  // Communication
  chatStarted: {
    type: Boolean,
    default: false
  },
  
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat'
  },
  
  lastInteraction: {
    type: Date,
    default: Date.now
  },
  
  // Cultural Exchange Tracking
  culturalExchange: {
    recipesShared: {
      user1ToUser2: [String],
      user2ToUser1: [String]
    },
    languageExchange: {
      user1Teaching: [String],
      user2Teaching: [String],
      sessionsCompleted: { type: Number, default: 0 }
    },
    festivalsDiscussed: [String],
    traditionsShared: [String],
    meetupsPlanned: [{
      event: String,
      date: Date,
      location: String,
      status: {
        type: String,
        enum: ['planned', 'confirmed', 'completed', 'cancelled'],
        default: 'planned'
      }
    }]
  },
  
  // Feedback and Rating
  feedback: {
    user1Rating: {
      type: Number,
      min: 1,
      max: 5
    },
    user2Rating: {
      type: Number,
      min: 1,
      max: 5
    },
    user1Feedback: String,
    user2Feedback: String,
    feedbackDate: Date
  },
  
  // Expiration
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    }
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for performance
matchSchema.index({ user1: 1, user2: 1 }, { unique: true });
matchSchema.index({ user1: 1, status: 1 });
matchSchema.index({ user2: 1, status: 1 });
matchSchema.index({ matchScore: -1 });
matchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
matchSchema.index({ lastInteraction: -1 });

// Compound index for finding matches
matchSchema.index({ 
  user1: 1, 
  status: 1, 
  matchScore: -1 
});

// Static method to find mutual matches
matchSchema.statics.findMutualMatches = function(userId) {
  return this.find({
    $or: [
      { user1: userId },
      { user2: userId }
    ],
    status: 'accepted',
    isActive: true
  }).populate('user1 user2', '-password');
};

// Static method to check if users are already matched
matchSchema.statics.areUsersMatched = async function(user1Id, user2Id) {
  const match = await this.findOne({
    $or: [
      { user1: user1Id, user2: user2Id },
      { user1: user2Id, user2: user1Id }
    ]
  });
  return match;
};

// Instance method to update match status
matchSchema.methods.updateUserAction = function(userId, action) {
  const isUser1 = this.user1.toString() === userId.toString();
  
  if (isUser1) {
    this.interactions.user1Action = action;
    this.interactions.user1ActionDate = new Date();
  } else {
    this.interactions.user2Action = action;
    this.interactions.user2ActionDate = new Date();
  }
  
  // Check if it's a mutual match
  if (this.interactions.user1Action === 'like' && this.interactions.user2Action === 'like') {
    this.status = 'accepted';
    this.chatStarted = false; // Will be set to true when chat is created
  } else if (this.interactions.user1Action === 'pass' || this.interactions.user2Action === 'pass') {
    this.status = 'declined';
  }
  
  this.lastInteraction = new Date();
  return this.save();
};

// Instance method to calculate match compatibility
matchSchema.methods.calculateCompatibility = function() {
  let compatibility = 0;
  const criteria = this.matchCriteria;
  
  // Common interests weight: 30%
  if (criteria.commonInterests && criteria.commonInterests.length > 0) {
    compatibility += Math.min(criteria.commonInterests.length * 10, 30);
  }
  
  // Complementary skills weight: 40%
  const teachingMatches = [
    ...criteria.complementarySkills.user1Teaches.filter(skill => 
      criteria.complementarySkills.user2Learns.includes(skill)
    ),
    ...criteria.complementarySkills.user2Teaches.filter(skill => 
      criteria.complementarySkills.user1Learns.includes(skill)
    )
  ];
  
  if (teachingMatches.length > 0) {
    compatibility += Math.min(teachingMatches.length * 10, 40);
  }
  
  // Cultural bridge weight: 30%
  if (criteria.culturalBridge.sharedLanguages && criteria.culturalBridge.sharedLanguages.length > 0) {
    compatibility += Math.min(criteria.culturalBridge.sharedLanguages.length * 5, 15);
  }
  
  if (criteria.culturalBridge.culturalSimilarities && criteria.culturalBridge.culturalSimilarities.length > 0) {
    compatibility += Math.min(criteria.culturalBridge.culturalSimilarities.length * 5, 15);
  }
  
  return Math.min(compatibility, 100);
};

// Pre-save hook to update match score
matchSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('matchCriteria')) {
    this.matchScore = this.calculateCompatibility();
  }
  next();
});

module.exports = mongoose.model('Match', matchSchema);
