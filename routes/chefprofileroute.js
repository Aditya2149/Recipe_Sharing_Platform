const express = require('express');
const chefProfileController = require('../controllers/chefprofilecontroller');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

// Get a chef's profile
router.get('/:chefId', chefProfileController.getChefProfile);

// Create or update chef profile (only accessible to logged-in chefs)
router.post('/', authMiddleware, chefProfileController.updateChefProfile);

// Add a review for a chef (only accessible to logged-in users)
router.post('/reviews', authMiddleware, chefProfileController.addReview);

module.exports = router;
