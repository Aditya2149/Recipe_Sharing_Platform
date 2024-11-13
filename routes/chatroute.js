const express = require('express');
const chatController = require('../controllers/chatcontroller');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

// Get chat messages for a booking
router.get('/:bookingId/messages', authMiddleware, chatController.getChatMessages);

module.exports = router;
