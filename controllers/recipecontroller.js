//recipecontroller.js
const pool = require('../config/db');

// Recipe creation (only chefs and admins)
exports.createRecipe = async (req, res) => {
    if (req.user.role !== 'chef' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
  const { title, description, category_id, ingredients, steps, difficulty, time, image_url } = req.body;

  try {
    // Insert recipe details with additional fields
    const result = await pool.query(
      `INSERT INTO recipes (chef_id, title, description, category_id, difficulty, time, image_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, title, description, category_id, difficulty, time, image_url]
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

// Update Recipe (Chefs and admins only)
exports.updateRecipe = async (req, res) => {
    if (req.user.role !== 'chef' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }
  const { id } = req.params;
  const { title, description, category_id, ingredients, steps, difficulty, time, image_url } = req.body;

  try {
    // Update recipe details with additional fields
    await pool.query(
      `UPDATE recipes SET title = $1, description = $2, category_id = $3, difficulty = $4, time = $5, image_url = $6 
       WHERE id = $7 AND chef_id = $8`,
      [title, description, category_id, difficulty, time, image_url, id, req.user.id]
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

// Delete Recipe (Chefs and admins only)
exports.deleteRecipe = async (req, res) => {
    if (req.user.role !== 'chef' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }
    const { id } = req.params;

    try {
        // Delete related ingredients and steps
        await pool.query('DELETE FROM ingredients WHERE recipe_id = $1', [id]);
        await pool.query('DELETE FROM steps WHERE recipe_id = $1', [id]);

        // Delete the recipe
        const result = await pool.query('DELETE FROM recipes WHERE id = $1 AND chef_id = $2 RETURNING *', [id, req.user.id]);

        // Check if the recipe was deleted
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Recipe not found or unauthorized' });
        }

        res.status(200).json({ message: 'Recipe deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

// Get Top 5 Rated Recipes
exports.getTopRatedRecipes = async (req, res) => {
  try {
    const query = `
        SELECT 
            r.id, 
            r.title, 
            r.description, 
            r.image_url,
            COALESCE(AVG(rr.rating), 0) AS average_rating
        FROM recipes r
        LEFT JOIN recipe_reviews rr ON r.id = rr.recipe_id
        GROUP BY r.id
        ORDER BY average_rating DESC, COUNT(rr.id) DESC
        LIMIT 5;
    `;

    const { rows } = await pool.query(query);
    res.json(rows);
} catch (error) {
    console.error("Error fetching top-rated recipes:", error);
    res.status(500).json({ error: "Internal Server Error" });
}
};

//advancedSearchRecipes function
exports.advancedSearchRecipes = async (req, res) => {
    const { query, category_id, difficulty, max_time, ingredients } = req.query;
    
    try {
      let baseQuery = `
        SELECT DISTINCT r.*
        FROM recipes r
        WHERE 1 = 1
      `;
      const values = [];
      let index = 1;
  
      // Filter by category if provided
      if (category_id) {
        baseQuery += ` AND r.category_id = $${index++}`;
        values.push(category_id);
      }
  
      // Filter by difficulty if provided - case insensitive
      if (difficulty) {
        baseQuery += ` AND LOWER(r.difficulty) = LOWER($${index++})`;
        values.push(difficulty);
      }
  
      // Filter by time if provided
      if (max_time) {
        baseQuery += ` AND r.time <= $${index++}`;
        values.push(max_time);
      }
  
      // Filter by ingredients - case insensitive
      if (ingredients) {
        // Clean and split ingredients, trimming whitespace and ignoring empty strings
        const ingredientsList = ingredients.split(',')
          .map(item => item.trim())
          .filter(item => item.length > 0)
          // Add wildcards to each ingredient for partial matching
          .map(item => `%${item}%`);
        
        if (ingredientsList.length > 0) {
          baseQuery += `
            AND EXISTS (
              SELECT 1 FROM ingredients i 
              WHERE i.recipe_id = r.id 
              AND LOWER(i.name) LIKE ANY(ARRAY[${ingredientsList.map((_, i) => `LOWER($${index + i})`).join(', ')}])
            )
          `;
          values.push(...ingredientsList);
          index += ingredientsList.length;
        }
      }
  
      // Full-text search - case insensitive
      if (query) {
        // Split the query into words for better partial matching
        const searchTerms = query.split(' ')
          .map(term => term.trim())
          .filter(term => term.length > 0);
        
        if (searchTerms.length > 0) {
          const searchConditions = searchTerms.map((_, i) => `
            LOWER(r.title) LIKE LOWER($${index + i})
            OR LOWER(r.description) LIKE LOWER($${index + i})
          `).join(' AND ');
  
          baseQuery += ` AND (${searchConditions})`;
          
          // Add wildcards to each search term for partial matching
          const searchValues = searchTerms.map(term => `%${term}%`);
          values.push(...searchValues);
          index += searchTerms.length;
        }
      }
  
      // Add ORDER BY clause for consistent results
      baseQuery += ` ORDER BY r.id`;
  
      console.log('Final SQL Query:', baseQuery);
      console.log('Query values:', values);
  
      const result = await pool.query(baseQuery, values);
      res.status(200).json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  };