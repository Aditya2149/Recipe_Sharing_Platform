const pool = require('../config/db');

// Fetch a chef's public profile
exports.getChefProfile = async (req, res) => {
    const { chefId } = req.params;

    try {
        // Fetch chef profile and user information using user_id
        const profileQuery = `
            SELECT u.name, u.email, cp.profile_picture, cp.experience, cp.expertise, cp.location
            FROM chef_profiles cp
            JOIN users u ON u.id = cp.user_id
            WHERE cp.user_id = $1
        `;
        const profileResult = await pool.query(profileQuery, [chefId]);

        if (profileResult.rows.length === 0) {
            return res.status(404).json({ message: 'Chef profile not found' });
        }

        // Fetch all reviews for the chef
        const reviewsQuery = `
            SELECT r.rating, r.comment, u.name AS reviewer_name, r.created_at
            FROM reviews r
            JOIN users u ON u.id = r.user_id
            WHERE r.chef_id = $1
            ORDER BY r.created_at DESC
        `;
        const reviewsResult = await pool.query(reviewsQuery, [chefId]);

        res.status(200).json({
            profile: profileResult.rows[0],
            reviews: reviewsResult.rows,
        });
    } catch (error) {
        console.error("Error fetching chef profile:", error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

// Create or update chef profile
exports.updateChefProfile = async (req, res) => {
    const { profilePicture, experience, expertise, location } = req.body;
    const userId = req.user.id;

    try {
        const upsertQuery = `
            INSERT INTO chef_profiles (user_id, profile_picture, experience, expertise, location)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id)
            DO UPDATE SET profile_picture = $2, experience = $3, expertise = $4, location = $5
            RETURNING *;
        `;
        const result = await pool.query(upsertQuery, [userId, profilePicture, experience, expertise, location]);
  
        res.status(200).json({ message: 'Profile updated successfully', profile: result.rows[0] });
    } catch (error) {
        console.error("Error updating chef profile:", error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

// Get all chefs' profiles with average rating
exports.getAllChefs = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT cp.id, cp.user_id, u.name AS full_name, cp.profile_picture, 
                   cp.experience, cp.expertise, cp.location, cp.created_at,
                   COALESCE(AVG(r.rating), 0) AS average_rating
            FROM chef_profiles cp
            JOIN users u ON cp.user_id = u.id
            LEFT JOIN reviews r ON cp.user_id = r.chef_id
            GROUP BY cp.id, u.name, cp.profile_picture, cp.experience, cp.expertise, cp.location, cp.created_at
            ORDER BY cp.created_at DESC
        `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching all chefs:", error);
        res.status(500).json({ error: "Something went wrong" });
    }
};



exports.getTopRatedChefs = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT cp.id, cp.user_id, u.name AS full_name, cp.profile_picture, 
                   cp.experience, cp.expertise, cp.location,
                   AVG(r.rating) AS average_rating
            FROM chef_profiles cp
            JOIN users u ON cp.user_id = u.id
            LEFT JOIN reviews r ON cp.user_id = r.chef_id
            GROUP BY cp.id, u.name, cp.profile_picture, cp.experience, cp.expertise, cp.location
            HAVING AVG(r.rating) IS NOT NULL
            ORDER BY average_rating DESC
            LIMIT 5
        `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching top-rated chefs:", error);
        res.status(500).json({ error: "Something went wrong" });
    }
};

// Add a review for a chef
exports.addReview = async (req, res) => {
    const { chefId, rating, comment } = req.body;
    const userId = req.user.id;

    try {
        const insertQuery = `
            INSERT INTO reviews (user_id, chef_id, rating, comment)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [userId, chefId, rating, comment]);

        res.status(201).json({ message: 'Review added successfully', review: result.rows[0] });
    } catch (error) {
        console.error("Error adding review:", error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

// Fetch all reviews for a specific chef
exports.getChefReviews = async (req, res) => {
    const { chefId } = req.params;

    try {
        const reviewsQuery = `
            SELECT r.id, r.rating, r.comment, u.name AS reviewer_name, r.created_at
            FROM reviews r
            JOIN users u ON u.id = r.user_id
            WHERE r.chef_id = $1
            ORDER BY r.created_at DESC
        `;
        const reviewsResult = await pool.query(reviewsQuery, [chefId]);

        res.status(200).json({
            chefId: chefId,
            reviews: reviewsResult.rows
        });
    } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};