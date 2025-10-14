const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get cultural heritage data by state
router.get('/heritage/:state', async (req, res) => {
  try {
    const { state } = req.params;
    
    // Sample cultural data - in production, this would come from a comprehensive database
    const heritageData = getCulturalDataByState(state);
    
    res.json({
      success: true,
      data: heritageData
    });

  } catch (error) {
    console.error('Get heritage data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch heritage data'
    });
  }
});

// Get all cultural content from users
router.get('/community-content', authMiddleware, async (req, res) => {
  try {
    const { type, state, limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    const matchCriteria = { isActive: true };
    if (state) {
      matchCriteria['culturalProfile.state'] = state;
    }
    
    const users = await User.find(matchCriteria)
      .select('name culturalProfile profilePicture')
      .lean();
    
    let allContent = [];
    
    users.forEach(user => {
      const userContent = [];
      
      if (!type || type === 'festivals') {
        user.culturalProfile.festivals.forEach(festival => {
          userContent.push({
            type: 'festival',
            ...festival,
            author: {
              name: user.name,
              profilePicture: user.profilePicture,
              state: user.culturalProfile.state
            }
          });
        });
      }
      
      if (!type || type === 'traditions') {
        user.culturalProfile.traditions.forEach(tradition => {
          userContent.push({
            type: 'tradition',
            ...tradition,
            author: {
              name: user.name,
              profilePicture: user.profilePicture,
              state: user.culturalProfile.state
            }
          });
        });
      }
      
      if (!type || type === 'cuisine') {
        user.culturalProfile.cuisine.forEach(dish => {
          userContent.push({
            type: 'cuisine',
            ...dish,
            author: {
              name: user.name,
              profilePicture: user.profilePicture,
              state: user.culturalProfile.state
            }
          });
        });
      }
      
      allContent.push(...userContent);
    });
    
    // Sort by most recent and paginate
    allContent.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const paginatedContent = allContent.slice(skip, skip + parseInt(limit));
    
    res.json({
      success: true,
      data: {
        content: paginatedContent,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: allContent.length,
          hasMore: (page * limit) < allContent.length
        }
      }
    });

  } catch (error) {
    console.error('Get community content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community content'
    });
  }
});

// Get cultural statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$culturalProfile.state',
          userCount: { $sum: 1 },
          totalFestivals: { $sum: { $size: '$culturalProfile.festivals' } },
          totalTraditions: { $sum: { $size: '$culturalProfile.traditions' } },
          totalCuisine: { $sum: { $size: '$culturalProfile.cuisine' } },
          languages: { $push: '$culturalProfile.primaryLanguages' }
        }
      },
      { $sort: { userCount: -1 } }
    ]);
    
    const overallStats = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalStates: { $addToSet: '$culturalProfile.state' },
          totalFestivals: { $sum: { $size: '$culturalProfile.festivals' } },
          totalTraditions: { $sum: { $size: '$culturalProfile.traditions' } },
          totalCuisine: { $sum: { $size: '$culturalProfile.cuisine' } },
          allLanguages: { $push: '$culturalProfile.primaryLanguages' }
        }
      }
    ]);
    
    const overall = overallStats[0] || {};
    const uniqueLanguages = [...new Set(overall.allLanguages?.flat() || [])];
    
    res.json({
      success: true,
      data: {
        overall: {
          totalUsers: overall.totalUsers || 0,
          totalStates: overall.totalStates?.length || 0,
          totalFestivals: overall.totalFestivals || 0,
          totalTraditions: overall.totalTraditions || 0,
          totalCuisine: overall.totalCuisine || 0,
          totalLanguages: uniqueLanguages.length
        },
        byState: stats
      }
    });

  } catch (error) {
    console.error('Get cultural stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cultural statistics'
    });
  }
});

// Sample cultural heritage data
function getCulturalDataByState(state) {
  const heritageDatabase = {
    'Maharashtra': {
      festivals: [
        {
          name: 'Ganesh Chaturthi',
          description: 'A 10-day festival celebrating Lord Ganesha',
          importance: 'Brings communities together in celebration',
          dates: 'August-September',
          traditions: ['Clay Ganesha idols', 'Community pandals', 'Modak preparation'],
          images: ['/images/ganesh-chaturthi.jpg']
        },
        {
          name: 'Gudi Padwa',
          description: 'Marathi New Year celebration',
          importance: 'Marks the beginning of the lunar calendar',
          dates: 'March-April',
          traditions: ['Gudi flag', 'Neem and jaggery', 'Rangoli'],
          images: ['/images/gudi-padwa.jpg']
        }
      ],
      cuisine: [
        {
          dishName: 'Vada Pav',
          description: 'Mumbai\'s iconic street food',
          ingredients: ['Potato dumpling', 'Pav bread', 'Chutneys'],
          occasion: 'Everyday snack',
          recipe: 'Deep fried potato dumpling served in bread with chutneys'
        },
        {
          dishName: 'Puran Poli',
          description: 'Sweet flatbread with lentil filling',
          ingredients: ['Chana dal', 'Jaggery', 'Wheat flour'],
          occasion: 'Festivals and celebrations',
          recipe: 'Sweet lentil filling wrapped in thin wheat bread'
        }
      ],
      artForms: [
        {
          name: 'Lavani',
          type: 'Dance',
          description: 'Traditional folk dance with powerful rhythm',
          characteristics: ['Rhythmic music', 'Colorful costumes', 'Expression']
        },
        {
          name: 'Warli Painting',
          type: 'Art',
          description: 'Tribal art form using geometric patterns',
          characteristics: ['White on brown', 'Geometric shapes', 'Rural themes']
        }
      ],
      languages: ['Marathi', 'Hindi'],
      traditions: [
        {
          name: 'Dahi Handi',
          description: 'Human pyramid formation to break clay pot',
          category: 'ritual',
          significance: 'Celebrates Krishna\'s mischievous nature'
        }
      ]
    },
    'Punjab': {
      festivals: [
        {
          name: 'Baisakhi',
          description: 'Harvest festival and Sikh New Year',
          importance: 'Celebrates harvest and Sikh heritage',
          dates: 'April 13-14',
          traditions: ['Bhangra dance', 'Gurdwara visits', 'Langar'],
          images: ['/images/baisakhi.jpg']
        },
        {
          name: 'Lohri',
          description: 'Bonfire festival celebrating winter solstice',
          importance: 'Marks end of winter season',
          dates: 'January 13',
          traditions: ['Bonfire', 'Rewari and til', 'Folk songs'],
          images: ['/images/lohri.jpg']
        }
      ],
      cuisine: [
        {
          dishName: 'Butter Chicken',
          description: 'Creamy tomato-based chicken curry',
          ingredients: ['Chicken', 'Tomatoes', 'Cream', 'Spices'],
          occasion: 'Celebrations and everyday meals',
          recipe: 'Chicken cooked in rich tomato and cream gravy'
        },
        {
          dishName: 'Makki di Roti & Sarson da Saag',
          description: 'Corn bread with mustard greens',
          ingredients: ['Corn flour', 'Mustard greens', 'Butter'],
          occasion: 'Winter specialty',
          recipe: 'Corn flatbread served with spiced mustard greens'
        }
      ],
      artForms: [
        {
          name: 'Bhangra',
          type: 'Dance',
          description: 'Energetic folk dance of Punjab',
          characteristics: ['Shoulder movements', 'Dhol beats', 'Colorful costumes']
        },
        {
          name: 'Phulkari',
          type: 'Textile',
          description: 'Traditional embroidery on shawls',
          characteristics: ['Bright threads', 'Geometric patterns', 'Cultural motifs']
        }
      ],
      languages: ['Punjabi', 'Hindi'],
      traditions: [
        {
          name: 'Langar',
          description: 'Community kitchen serving free meals',
          category: 'ritual',
          significance: 'Promotes equality and service'
        }
      ]
    },
    'Kerala': {
      festivals: [
        {
          name: 'Onam',
          description: '10-day harvest festival',
          importance: 'Celebrates King Mahabali\'s return',
          dates: 'August-September',
          traditions: ['Pookalam', 'Onasadya', 'Kathakali'],
          images: ['/images/onam.jpg']
        },
        {
          name: 'Thrissur Pooram',
          description: 'Temple festival with elephant procession',
          importance: 'Spectacular cultural celebration',
          dates: 'April-May',
          traditions: ['Elephant parade', 'Fireworks', 'Traditional music'],
          images: ['/images/thrissur-pooram.jpg']
        }
      ],
      cuisine: [
        {
          dishName: 'Sadya',
          description: 'Traditional vegetarian feast served on banana leaf',
          ingredients: ['Rice', 'Sambar', 'Rasam', 'Various curries'],
          occasion: 'Onam and weddings',
          recipe: 'Multiple dishes served in specific order on banana leaf'
        },
        {
          dishName: 'Fish Curry',
          description: 'Coconut-based fish curry',
          ingredients: ['Fish', 'Coconut milk', 'Curry leaves', 'Spices'],
          occasion: 'Daily meals',
          recipe: 'Fish cooked in spiced coconut milk gravy'
        }
      ],
      artForms: [
        {
          name: 'Kathakali',
          type: 'Dance',
          description: 'Classical dance-drama with elaborate makeup',
          characteristics: ['Face painting', 'Expressive eyes', 'Hand gestures']
        },
        {
          name: 'Theyyam',
          type: 'Ritual Art',
          description: 'Ritualistic art form and dance',
          characteristics: ['Divine impersonation', 'Elaborate costumes', 'Folk tradition']
        }
      ],
      languages: ['Malayalam', 'Tamil'],
      traditions: [
        {
          name: 'Ayurveda',
          description: 'Traditional system of medicine',
          category: 'other',
          significance: 'Holistic health and wellness practices'
        }
      ]
    }
  };

  return heritageDatabase[state] || {
    festivals: [],
    cuisine: [],
    artForms: [],
    languages: [],
    traditions: [],
    message: 'Cultural data for this state is being compiled. Please check back soon!'
  };
}

module.exports = router;
