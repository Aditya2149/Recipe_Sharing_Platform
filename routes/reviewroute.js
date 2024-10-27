const express = require('express');
const reviewController = require('../controllers/reviewcontroller');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

// Add a review (only "user" and "admin")
router.post('/add', authMiddleware, reviewController.addReview);

// Update a review (only "user" and "admin")
router.put('/update', authMiddleware, reviewController.updateReview);

// Delete a review (only "user" and "admin")
router.delete('/delete/:review_id', authMiddleware, reviewController.deleteReview);

// Get reviews for a specific recipe (accessible to everyone)
router.get('/:recipe_id', reviewController.getReviewsForRecipe);

module.exports = router;
