const pool = require('../config/db');

// Get chat messages for a booking
exports.getChatMessages = async (req, res) => {
    const { bookingId } = req.params;

    try {
        const query = `
            SELECT m.id, m.sender_id, m.receiver_id, m.message, m.created_at
            FROM messages m
            WHERE m.booking_id = $1
            ORDER BY m.created_at ASC;
        `;
        const result = await pool.query(query, [bookingId]);

        res.status(200).json({ messages: result.rows });
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};
