const express = require('express');
const chefProfileController = require('../controllers/chefprofilecontroller');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

// Route to get all chefs
router.get("/all", chefProfileController.getAllChefs);

// Route to get top-rated chefs
router.get("/top-rated", chefProfileController.getTopRatedChefs);

// Get a chef's profile
router.get('/:chefId', chefProfileController.getChefProfile);

// Create or update chef profile (only accessible to logged-in chefs)
router.post('/', authMiddleware, chefProfileController.updateChefProfile);

// Add a review for a chef (only accessible to logged-in users)
router.post('/reviews', authMiddleware, chefProfileController.addReview);

// Fetch all reviews for a specific chef
router.get('/reviews/:chefId', chefProfileController.getChefReviews);

module.exports = router;
