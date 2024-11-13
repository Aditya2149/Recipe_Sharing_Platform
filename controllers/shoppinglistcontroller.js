const db = require('../config/db'); // Assuming you have a database module for queries

// Fetch shopping list by recipe ID
exports.getShoppingList = async (req, res) => {
    const { recipeId } = req.params;

    try {
        const query = `
            SELECT name, quantity
            FROM ingredients
            WHERE recipe_id = $1
        `;
        const { rows: ingredients } = await db.query(query, [recipeId]);

        if (ingredients.length === 0) {
            return res.status(404).json({ message: 'No ingredients found for this recipe.' });
        }

        res.status(200).json({
            recipeId,
            shoppingList: ingredients,
        });
    } catch (error) {
        console.error('Error fetching shopping list:', error);
        res.status(500).json({ message: 'An error occurred while fetching the shopping list.' });
    }
};
