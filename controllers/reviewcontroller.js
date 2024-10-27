const pool = require('../config/db');

// Add a new review (only "user" and "admin")
exports.addReview = async (req, res) => {
    const { recipe_id, rating, comment } = req.body;
    const { id: user_id, role } = req.user;  // Get user ID and role from the decoded token

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    if (role !== 'user' && role !== 'admin') {
        return res.status(403).json({ message: 'You do not have permission to add reviews' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO recipe_reviews (recipe_id, user_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING *',
            [recipe_id, user_id, rating, comment]
        );

        res.status(201).json({ message: 'Review added successfully', review: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

// Update an existing review (only "user" and "admin")
exports.updateReview = async (req, res) => {
    const { review_id, rating, comment } = req.body;
    const { id: user_id, role } = req.user;

    if (role !== 'user' && role !== 'admin') {
        return res.status(403).json({ message: 'You do not have permission to update reviews' });
    }

    try {
        // Check if the review belongs to the user or if the role is admin
        const review = await pool.query('SELECT * FROM recipe_reviews WHERE id = $1', [review_id]);
        
        if (!review.rows[0]) {
            return res.status(404).json({ message: 'Review not found' });
        }

        if (review.rows[0].user_id !== user_id && role !== 'admin') {
            return res.status(403).json({ message: 'You can only update your own reviews' });
        }

        const result = await pool.query(
            'UPDATE recipe_reviews SET rating = $1, comment = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [rating, comment, review_id]
        );

        res.status(200).json({ message: 'Review updated successfully', review: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

// Delete a review (only "user" and "admin")
exports.deleteReview = async (req, res) => {
    const { review_id } = req.params;
    const { id: user_id, role } = req.user;

    if (role !== 'user' && role !== 'admin') {
        return res.status(403).json({ message: 'You do not have permission to delete reviews' });
    }

    try {
        const review = await pool.query('SELECT * FROM recipe_reviews WHERE id = $1', [review_id]);

        if (!review.rows[0]) {
            return res.status(404).json({ message: 'Review not found' });
        }

        if (review.rows[0].user_id !== user_id && role !== 'admin') {
            return res.status(403).json({ message: 'You can only delete your own reviews' });
        }

        await pool.query('DELETE FROM recipe_reviews WHERE id = $1', [review_id]);

        res.status(200).json({ message: 'Review deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

// Get reviews for a specific recipe (accessible to everyone)
exports.getReviewsForRecipe = async (req, res) => {
    const { recipe_id } = req.params;

    try {
        const result = await pool.query(
            'SELECT rr.*, u.name as user_name FROM recipe_reviews rr JOIN users u ON rr.user_id = u.id WHERE rr.recipe_id = $1 ORDER BY rr.created_at DESC',
            [recipe_id]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};
