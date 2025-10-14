const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

// Demo users data
const demoUsers = [
  {
    name: 'Demo User',
    email: 'demo@sanskriti.com',
    password: 'demo123',
    age: 25,
    gender: 'Male',
    culturalProfile: {
      state: 'Maharashtra',
      city: 'Mumbai',
      primaryLanguages: ['Hindi', 'Marathi'],
      regionalLanguages: ['English'],
      bio: 'Cultural enthusiast & Love sharing Maharashtrian traditions!',
      festivals: [{
        name: 'Ganesh Chaturthi',
        description: 'Grand celebration of Lord Ganesha',
        importance: 'Most important festival in Maharashtra'
      }],
      artForms: ['music', 'dance'],
      culturalInterests: ['history', 'religious_practices', 'folk_tales']
    },
    learningPreferences: {
      interestedStates: ['Kerala', 'Punjab', 'Gujarat'],
      learningGoals: ['language', 'cooking', 'festivals'],
      teachingSkills: ['traditions', 'art', 'history']
    },
    gamification: {
      points: 1250,
      level: 3
    }
  },
  {
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    password: 'priya123',
    age: 23,
    gender: 'Female',
    culturalProfile: {
      state: 'Punjab',
      city: 'Chandigarh',
      primaryLanguages: ['Punjabi', 'Hindi'],
      regionalLanguages: ['English'],
      bio: 'Love sharing Punjabi traditions and learning about other cultures!',
      festivals: [{
        name: 'Baisakhi',
        description: 'Harvest festival of Punjab',
        importance: 'Celebrates the harvest season'
      }],
      artForms: ['dance', 'music'],
      culturalInterests: ['festivals', 'folk_tales', 'handicrafts']
    },
    learningPreferences: {
      interestedStates: ['Kerala', 'Gujarat', 'Maharashtra'],
      learningGoals: ['cooking', 'festivals', 'language'],
      teachingSkills: ['dance', 'festivals', 'cooking']
    },
    gamification: {
      points: 920,
      level: 2
    }
  },
  {
    name: 'Arjun Nair',
    email: 'arjun.nair@example.com',
    password: 'arjun123',
    age: 27,
    gender: 'Male',
    culturalProfile: {
      state: 'Kerala',
      city: 'Kochi',
      primaryLanguages: ['Malayalam', 'Tamil'],
      regionalLanguages: ['Hindi', 'English'],
      bio: 'Kathakali artist eager to share Kerala\'s rich heritage and learn about other Indian cultures.',
      festivals: [{
        name: 'Onam',
        description: 'Harvest festival of Kerala',
        importance: 'State festival celebrating King Mahabali'
      }],
      artForms: ['dance', 'music'],
      culturalInterests: ['art', 'mythology', 'traditions']
    },
    learningPreferences: {
      interestedStates: ['Rajasthan', 'Gujarat', 'Punjab'],
      learningGoals: ['art', 'traditions', 'festivals'],
      teachingSkills: ['dance', 'art', 'traditions']
    },
    gamification: {
      points: 1580,
      level: 4
    }
  },
  {
    name: 'Meera Patel',
    email: 'meera.patel@example.com',
    password: 'meera123',
    age: 24,
    gender: 'Female',
    culturalProfile: {
      state: 'Gujarat',
      city: 'Ahmedabad',
      primaryLanguages: ['Gujarati', 'Hindi'],
      regionalLanguages: ['English'],
      bio: 'Passionate about Gujarati cuisine and Garba dance. Love connecting with people from different states!',
      festivals: [{
        name: 'Navratri',
        description: 'Nine-day festival celebrating Goddess Durga',
        importance: 'Most important festival in Gujarat'
      }],
      artForms: ['dance'],
      culturalInterests: ['festivals', 'handicrafts', 'folk_tales']
    },
    learningPreferences: {
      interestedStates: ['Rajasthan', 'Punjab', 'Kerala'],
      learningGoals: ['festivals', 'cooking', 'art'],
      teachingSkills: ['dance', 'festivals', 'cooking']
    },
    gamification: {
      points: 750,
      level: 2
    }
  },
  {
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@example.com',
    password: 'rajesh123',
    age: 29,
    gender: 'Male',
    culturalProfile: {
      state: 'Rajasthan',
      city: 'Jaipur',
      primaryLanguages: ['Hindi', 'Rajasthani'],
      regionalLanguages: ['English'],
      bio: 'Folk musician from the royal state of Rajasthan. Expert in traditional Rajasthani music and crafts.',
      festivals: [{
        name: 'Desert Festival',
        description: 'Annual cultural festival in Rajasthan',
        importance: 'Showcases Rajasthani culture and traditions'
      }],
      artForms: ['music', 'craft'],
      culturalInterests: ['music', 'royal_heritage', 'handicrafts']
    },
    learningPreferences: {
      interestedStates: ['Kerala', 'Tamil Nadu', 'West Bengal'],
      learningGoals: ['music', 'art', 'history'],
      teachingSkills: ['music', 'handicrafts', 'history']
    },
    gamification: {
      points: 2100,
      level: 5
    }
  }
];

// Seed database function
async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sanskriti-setu', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('📡 Connected to MongoDB');

    // Clear existing users (optional)
    const existingUsers = await User.countDocuments();
    console.log(`📊 Existing users in database: ${existingUsers}`);

    // Check if demo user already exists
    const existingDemoUser = await User.findOne({ email: 'demo@sanskriti.com' });
    
    if (existingDemoUser) {
      console.log('✅ Demo user already exists');
      console.log('🔐 Login with: demo@sanskriti.com / demo123');
    } else {
      // Add demo users
      console.log('🌱 Seeding database with demo users...');
      
      for (const userData of demoUsers) {
        const user = new User(userData);
        await user.save();
        console.log(`✅ Created user: ${user.name} (${user.email})`);
      }
    }

    // Display all users
    const allUsers = await User.find().select('name email culturalProfile.state culturalProfile.city');
    console.log('\n👥 Users in database:');
    allUsers.forEach(user => {
      console.log(`- ${user.name} from ${user.culturalProfile.city}, ${user.culturalProfile.state}`);
    });

    console.log('\n🎉 Database seeding completed!');
    console.log('\n🔐 Demo login credentials:');
    console.log('Email: demo@sanskriti.com');
    console.log('Password: demo123');
    
    mongoose.connection.close();

  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

// Run seeder
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
