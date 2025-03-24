const express = require('express');
const recipeController = require('../controllers/recipecontroller');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const router = express.Router();

// Public routes
router.get('/', recipeController.getAllRecipes);
router.get('/search', recipeController.advancedSearchRecipes);
router.get("/top-rated", recipeController.getTopRatedRecipes);
router.get('/:id', recipeController.getRecipeById);

// Routes for Chefs (authenticated users with 'chef' role)
router.post('/', authMiddleware, roleMiddleware(['chef', 'admin']), recipeController.createRecipe);
router.put('/:id', authMiddleware, roleMiddleware(['chef', 'admin']), recipeController.updateRecipe);
router.delete('/:id', authMiddleware, roleMiddleware(['chef', 'admin']), recipeController.deleteRecipe);

module.exports = router;
