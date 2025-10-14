const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Simple chat routes (for MVP, can be expanded with proper Chat model)
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    // This would typically fetch actual conversations from database
    // For MVP, returning mock data
    res.json({
      success: true,
      data: {
        conversations: [
          {
            id: '1',
            participant: {
              name: 'Priya Sharma',
              state: 'Punjab',
              profilePicture: '/images/profiles/priya.jpg'
            },
            lastMessage: 'Thanks for sharing that Lohri recipe!',
            timestamp: new Date(Date.now() - 2*60*60*1000),
            unreadCount: 2
          },
          {
            id: '2',
            participant: {
              name: 'Arjun Nair',
              state: 'Kerala',
              profilePicture: '/images/profiles/arjun.jpg'
            },
            lastMessage: 'The Kathakali performance was amazing',
            timestamp: new Date(Date.now() - 5*60*60*1000),
            unreadCount: 0
          }
        ]
      }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations'
    });
  }
});

router.get('/messages/:conversationId', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Mock messages for MVP
    res.json({
      success: true,
      data: {
        messages: [
          {
            id: '1',
            senderId: 'other',
            content: 'Hi! I see you\'re from Maharashtra. I\'d love to learn about Ganesh Chaturthi!',
            timestamp: new Date(Date.now() - 3*60*60*1000),
            type: 'text'
          },
          {
            id: '2',
            senderId: 'me',
            content: 'Hello! I\'d be happy to share. It\'s such a beautiful festival. Are you interested in the traditions or the food?',
            timestamp: new Date(Date.now() - 2.5*60*60*1000),
            type: 'text'
          },
          {
            id: '3',
            senderId: 'other',
            content: 'Both! I especially want to know about making modaks.',
            timestamp: new Date(Date.now() - 2*60*60*1000),
            type: 'text'
          }
        ]
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
});

module.exports = router;
