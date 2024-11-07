const express = require('express');
const paymentController = require('../controllers/paymentcontroller');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

// Route to process payment
router.post('/process', authMiddleware, paymentController.processPayment);

// Route to process refunds
router.post('/confirm', authMiddleware, paymentController.confirmBooking);

module.exports = router;
