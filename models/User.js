const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profilePicture: {
    type: String,
    default: ''
  },
  age: {
    type: Number,
    required: true,
    min: 13,
    max: 100
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Non-binary', 'Other'],
    required: true
  },

  // Cultural Profile
  culturalProfile: {
    state: {
      type: String,
      required: true,
      enum: [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
        'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
        'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
        'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
        'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
        'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
        'Lakshadweep', 'Puducherry', 'Andaman and Nicobar Islands'
      ]
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    primaryLanguages: [{
      type: String,
      required: true
    }],
    regionalLanguages: [{
      type: String
    }],
    festivals: [{
      name: String,
      description: String,
      importance: String,
      images: [String]
    }],
    traditions: [{
      name: String,
      description: String,
      category: {
        type: String,
        enum: ['food', 'art', 'music', 'dance', 'craft', 'ritual', 'game', 'other']
      },
      images: [String],
      videos: [String]
    }],
    cuisine: [{
      dishName: String,
      description: String,
      recipe: String,
      occasion: String,
      images: [String]
    }],
    artForms: [{
      type: String,
      enum: ['dance', 'music', 'painting', 'sculpture', 'textile', 'pottery', 'other']
    }],
    culturalInterests: [{
      type: String,
      enum: ['history', 'mythology', 'literature', 'architecture', 'handicrafts',
        'folk_tales', 'religious_practices', 'tribal_culture', 'royal_heritage', 'festivals']
    }],
    bio: {
      type: String,
      maxlength: 500,
      default: ''
    }
  },

  // Learning Preferences
  learningPreferences: {
    interestedStates: [{
      type: String
    }],
    learningGoals: [{
      type: String,
      enum: ['language', 'cooking', 'festivals', 'traditions', 'art', 'history', 'travel']
    }],
    teachingSkills: [{
      type: String,
      enum: ['language', 'cooking', 'festivals', 'traditions', 'art', 'history', 'travel', 'dance']
    }],
    availableFor: {
      chat: { type: Boolean, default: true },
      videoCalls: { type: Boolean, default: false },
      meetups: { type: Boolean, default: false },
      culturalEvents: { type: Boolean, default: true }
    }
  },

  // Gamification
  gamification: {
    points: {
      type: Number,
      default: 0
    },
    level: {
      type: Number,
      default: 1
    },
    badges: [{
      name: String,
      description: String,
      earnedAt: Date,
      icon: String
    }],
    achievements: [{
      type: String,
      earnedAt: Date
    }],
    streaks: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastActive: Date
    }
  },

  // Activity Tracking
  activity: {
    totalMatches: { type: Number, default: 0 },
    totalChats: { type: Number, default: 0 },
    culturalContentShared: { type: Number, default: 0 },
    eventsAttended: { type: Number, default: 0 },
    profileViews: { type: Number, default: 0 }
  },

  // Privacy Settings
  privacy: {
    profileVisibility: {
      type: String,
      enum: ['public', 'matches_only', 'private'],
      default: 'public'
    },
    showLocation: { type: Boolean, default: true },
    showAge: { type: Boolean, default: true },
    allowMessages: { type: Boolean, default: true }
  },

  // System Fields
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ 'culturalProfile.state': 1 });
userSchema.index({ 'culturalProfile.primaryLanguages': 1 });
userSchema.index({ 'learningPreferences.interestedStates': 1 });
userSchema.index({ 'gamification.points': -1 });
userSchema.index({ lastSeen: -1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Calculate profile completion percentage
userSchema.methods.calculateProfileCompletion = function () {
  let completionPercentage = 0;
  const requiredFields = [
    'name', 'email', 'culturalProfile.state', 'culturalProfile.city',
    'culturalProfile.primaryLanguages', 'culturalProfile.bio'
  ];

  requiredFields.forEach(field => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], this);
    if (value && (Array.isArray(value) ? value.length > 0 : true)) {
      completionPercentage += 100 / requiredFields.length;
    }
  });

  return Math.round(completionPercentage);
};

// Update points and level
userSchema.methods.addPoints = function (points) {
  this.gamification.points += points;
  this.gamification.level = Math.floor(this.gamification.points / 100) + 1;
  return this.save();
};

// Update last seen
userSchema.methods.updateLastSeen = function () {
  this.lastSeen = new Date();
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
