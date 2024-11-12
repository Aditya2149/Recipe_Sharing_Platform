const express = require('express');
const userDashboardController = require('../controllers/userdashboardcontroller');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

// Get past bookings
router.get('/bookings', authMiddleware, userDashboardController.getPastBookings);

// Get payment history
router.get('/payments', authMiddleware, userDashboardController.getPaymentHistory);

// Add to favorites
router.post('/favorites', authMiddleware, userDashboardController.addToFavorites);

// Remove from favorites
router.delete('/favorites', authMiddleware, userDashboardController.removeFromFavorites);

module.exports = router;
