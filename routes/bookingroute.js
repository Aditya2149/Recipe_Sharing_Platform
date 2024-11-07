const express = require('express');
const bookingController = require('../controllers/bookingcontroller');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

// Route to create a new booking
router.post('/initiate', authMiddleware, bookingController.initiateBooking);

router.post('/cancel/:booking_id', authMiddleware, bookingController.cancelBooking);

module.exports = router;
