const pool = require('../config/db');
const moment = require('moment-timezone');

// Add chef availability
exports.addAvailability = async (req, res) => {
    const { available_date, start_time, end_time } = req.body;
    const chef_id = req.user.id;  // Authenticated chef's ID
    const timezone = req.header('timezone') || 'UTC';  // Chef's timezone from header

    try {
        // Combine available_date with start_time and convert to UTC
        const utcStartDateTime = moment.tz(`${available_date} ${start_time}`, timezone).utc();
        const utcEndDateTime = moment.tz(`${available_date} ${end_time}`, timezone).utc();

        const utcAvailableDate = utcStartDateTime.format('YYYY-MM-DD');
        const utcStartTime = utcStartDateTime.format('HH:mm:ss');
        const utcEndTime = utcEndDateTime.format('HH:mm:ss');

        // Insert into the database
        const result = await pool.query(
            'INSERT INTO chef_availability (chef_id, available_date, start_time, end_time, timezone) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [chef_id, utcAvailableDate, utcStartTime, utcEndTime, 'UTC']
        );

        // Format the response properly
        const addedAvailability = {
            id: result.rows[0].id,
            chef_id: result.rows[0].chef_id,
            available_date: utcAvailableDate,
            start_time: utcStartTime,
            end_time: utcEndTime,
            timezone: 'UTC',
            created_at: result.rows[0].created_at
        };

        res.status(201).json({ message: 'Availability added successfully', availability: addedAvailability });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

// Fetch chef availability
exports.getAvailability = async (req, res) => {
    const { chef_id } = req.params;
    const clientTimezone = req.header('timezone') || 'UTC';

    try {
        const result = await pool.query(
            'SELECT * FROM chef_availability WHERE chef_id = $1 AND available_date >= CURRENT_DATE ORDER BY available_date, start_time',
            [chef_id]
        );

        // Convert stored UTC times to client's timezone
        const availability = result.rows.map(entry => {
            // Log raw database values
            console.log('Raw DB values:', {
                date: entry.available_date,
                startTime: entry.start_time,
                endTime: entry.end_time
            });

            // Create UTC date-time by combining date and time strings
            const dateStr = moment(entry.available_date).format('YYYY-MM-DD');
            const startTimeStr = moment(entry.start_time, 'HH:mm:ss').format('HH:mm:ss');
            const endTimeStr = moment(entry.end_time, 'HH:mm:ss').format('HH:mm:ss');

            // Create full UTC datetime strings
            const utcStartStr = `${dateStr}T${startTimeStr}Z`;
            const utcEndStr = `${dateStr}T${endTimeStr}Z`;

            // Convert to moment objects in UTC
            const utcStart = moment.utc(utcStartStr);
            const utcEnd = moment.utc(utcEndStr);

            // Convert to client timezone
            const localStart = utcStart.tz(clientTimezone);
            const localEnd = utcEnd.tz(clientTimezone);

            // Debug logging
            console.log('Conversion steps:', {
                utcStartStr,
                utcEndStr,
                localStartFull: localStart.format(),
                localEndFull: localEnd.format()
            });

            // Format the output
            const localDate = localStart.format('YYYY-MM-DD');
            const localStartTime = localStart.format('HH:mm:ss');
            const localEndTime = localEnd.format('HH:mm:ss');

            return {
                ...entry,
                available_date: localDate,
                start_time: localStartTime,
                end_time: localEndTime,
                timezone: clientTimezone
            };
        });

        res.status(200).json(availability);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};