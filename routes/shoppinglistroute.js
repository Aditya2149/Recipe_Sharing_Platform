const express = require('express');
const router = express.Router();
const shoppingListController = require('../controllers/shoppinglistcontroller');

// Route to fetch shopping list for a recipe
router.get('/:recipeId', shoppingListController.getShoppingList);

module.exports = router;
