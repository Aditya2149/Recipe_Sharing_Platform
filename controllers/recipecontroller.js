//recipecontroller.js
const pool = require('../config/db');

// Recipe creation (only chefs and admins)
exports.createRecipe = async (req, res) => {
    if (req.user.role !== 'chef' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
  const { title, description, category_id, ingredients, steps } = req.body;

  try {
    // Insert recipe details
    const result = await pool.query(
      'INSERT INTO recipes (chef_id, title, description, category_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, title, description, category_id]
    );
    
    const recipeId = result.rows[0].id;

    // Insert ingredients
    for (const ingredient of ingredients) {
      await pool.query(
        'INSERT INTO ingredients (recipe_id, name, quantity) VALUES ($1, $2, $3)',
        [recipeId, ingredient.name, ingredient.quantity]
      );
    }

    // Insert steps
    for (const [index, step] of steps.entries()) {
      await pool.query(
        'INSERT INTO steps (recipe_id, step_number, description) VALUES ($1, $2, $3)',
        [recipeId, index + 1, step]
      );
    }

    res.status(201).json({ message: 'Recipe created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// Get All Recipes
exports.getAllRecipes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM recipes');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// Get Recipe by ID
exports.getRecipeById = async (req, res) => {
  const { id } = req.params;

  try {
    const recipe = await pool.query('SELECT * FROM recipes WHERE id = $1', [id]);
    const ingredients = await pool.query('SELECT * FROM ingredients WHERE recipe_id = $1', [id]);
    const steps = await pool.query('SELECT * FROM steps WHERE recipe_id = $1', [id]);

    if (!recipe.rows.length) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    res.status(200).json({
      recipe: recipe.rows[0],
      ingredients: ingredients.rows,
      steps: steps.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// Update Recipe (Chefs only)
exports.updateRecipe = async (req, res) => {
    if (req.user.role !== 'chef' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }
  const { id } = req.params;
  const { title, description, category_id, ingredients, steps } = req.body;

  try {
    // Update recipe details
    await pool.query(
      'UPDATE recipes SET title = $1, description = $2, category_id = $3 WHERE id = $4 AND chef_id = $5',
      [title, description, category_id, id, req.user.id]
    );

    // Delete old ingredients and steps
    await pool.query('DELETE FROM ingredients WHERE recipe_id = $1', [id]);
    await pool.query('DELETE FROM steps WHERE recipe_id = $1', [id]);

    // Insert new ingredients
    for (const ingredient of ingredients) {
      await pool.query(
        'INSERT INTO ingredients (recipe_id, name, quantity) VALUES ($1, $2, $3)',
        [id, ingredient.name, ingredient.quantity]
      );
    }

    // Insert new steps
    for (const [index, step] of steps.entries()) {
      await pool.query(
        'INSERT INTO steps (recipe_id, step_number, description) VALUES ($1, $2, $3)',
        [id, index + 1, step]
      );
    }

    res.status(200).json({ message: 'Recipe updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// Delete Recipe (Chefs only)
exports.deleteRecipe = async (req, res) => {
    if (req.user.role !== 'chef' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM recipes WHERE id = $1 AND chef_id = $2', [id, req.user.id]);
    res.status(200).json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// Search and Filter Recipes
exports.searchRecipes = async (req, res) => {
    const { query, category_id } = req.query;
  
    try {
      let baseQuery = 'SELECT * FROM recipes WHERE 1 = 1';
      const values = [];
  
      // Filter by category if provided
      if (category_id) {
        baseQuery += ' AND category_id = $1';
        values.push(category_id);
      }
  
      // Search by title or ingredients if query provided
      if (query) {
        baseQuery += ` AND (
          title ILIKE $${values.length + 1} OR
          EXISTS (
            SELECT 1 FROM ingredients WHERE ingredients.recipe_id = recipes.id AND ingredients.name ILIKE $${values.length + 1}
          )
        )`;
        values.push(`%${query}%`);
      }
  
      const result = await pool.query(baseQuery, values);
      res.status(200).json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  };
  
