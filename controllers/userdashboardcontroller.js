const pool = require('../config/db');

// Get past bookings
exports.getPastBookings = async (req, res) => {
    const userId = req.user.id;

    try {
        const query = `
            SELECT 
                b.id AS booking_id, 
                b.chef_id, 
                b.booking_date, 
                b.start_time, 
                b.end_time, 
                b.service_type, 
                b.rate AS price, 
                b.status, 
                u.name AS chef_name
            FROM bookings b
            JOIN users u ON b.chef_id = u.id
            WHERE b.user_id = $1
            ORDER BY b.booking_date DESC;
        `;
        const result = await pool.query(query, [userId]);

        res.status(200).json({ bookings: result.rows });
    } catch (error) {
        console.error('Error fetching past bookings:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

// Manage payments (get payment history)
exports.getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user.id; // Assume user ID is stored in the request object
        const query = `
            SELECT 
                b.id AS booking_id,
                b.booking_date, 
                b.service_type, 
                b.rate AS rate, 
                b.status, 
                b.payment_intent_id,
                u.name AS chef_name
            FROM bookings b
            JOIN users u ON b.chef_id = u.id
            WHERE b.user_id = $1
            ORDER BY b.booking_date DESC;
        `;
        const values = [userId];
        const { rows } = await pool.query(query, values);
        res.status(200).json({ paymentHistory: rows });
    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({ error: 'Failed to fetch payment history' });
    }
};


// Add to favorites (chef or recipe)
exports.addToFavorites = async (req, res) => {
    const { chefId, recipeId } = req.body;
    const userId = req.user.id;

    if (!chefId && !recipeId) {
        return res.status(400).json({ message: 'Please provide a chefId or recipeId' });
    }

    try {
        const query = `
            INSERT INTO favorites (user_id, chef_id, recipe_id)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            RETURNING *;
        `;
        const result = await pool.query(query, [userId, chefId || null, recipeId || null]);

        res.status(201).json({ favorite: result.rows[0] });
    } catch (error) {
        console.error('Error adding to favorites:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

// Remove from favorites (chef or recipe)
exports.removeFromFavorites = async (req, res) => {
    const { chefId, recipeId } = req.body;
    const userId = req.user.id;

    if (!chefId && !recipeId) {
        return res.status(400).json({ message: 'Please provide a chefId or recipeId' });
    }

    try {
        const query = `
            DELETE FROM favorites
            WHERE user_id = $1 AND (chef_id = $2 OR recipe_id = $3)
            RETURNING *;
        `;
        const result = await pool.query(query, [userId, chefId || null, recipeId || null]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Favorite not found' });
        }

        res.status(200).json({ message: 'Removed from favorites', removed: result.rows[0] });
    } catch (error) {
        console.error('Error removing from favorites:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};
