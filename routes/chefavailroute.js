const express = require('express');
const chefAvailabilityController = require('../controllers/chefavailcontroller');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

// Route to add chef availability
router.post('/add', authMiddleware, chefAvailabilityController.addAvailability);

// Route to get availability for a specific chef
router.get('/:chef_id', chefAvailabilityController.getAvailability);

module.exports = router;
