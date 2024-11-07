const pool = require('../config/db');
const moment = require('moment-timezone');
const notificationController = require('./notificationcontroller');

// Initiate a booking with availability handling
exports.initiateBooking = async (req, res) => {
    const { chef_id, booking_date, start_time, end_time, service_type } = req.body;
    const user_id = req.user.id;
    const userTimezone = req.header('Timezone') || 'UTC';

    try {
        // Log raw inputs for debugging
        console.log("Raw inputs:", { chef_id, booking_date, start_time, end_time, service_type });

        // Convert to UTC
        const utcStartDateTime = moment.tz(`${booking_date} ${start_time}`, userTimezone).utc();
        const utcEndDateTime = moment.tz(`${booking_date} ${end_time}`, userTimezone).utc();

        // Log converted UTC times for debugging
        console.log("UTC Start:", utcStartDateTime.format(), "UTC End:", utcEndDateTime.format());

        const bookingDateUTC = utcStartDateTime.format('YYYY-MM-DD');
        const startTimeUTC = utcStartDateTime.format('HH:mm:ss');
        const endTimeUTC = utcEndDateTime.format('HH:mm:ss');

        // Check chef availability
        const availabilityResult = await pool.query(
            `SELECT * FROM chef_availability WHERE chef_id = $1 AND available_date = $2 
             AND start_time <= $3 AND end_time >= $4`,
            [chef_id, bookingDateUTC, startTimeUTC, endTimeUTC]
        );

        const availability = availabilityResult.rows[0];

        if (!availability) {
            console.error("Chef availability not found for the given time slot.");
            return res.status(400).json({ message: 'Selected time slot is not available' });
        }

        // Validate rates for the service type
        const rate = service_type === 'online' ? availability.online_rate : availability.offline_rate;
        if (!rate || rate === '0.00') {
            console.error(`Invalid rate for service type: ${service_type}`);
            return res.status(400).json({ message: `No rate set for ${service_type} service` });
        }

        // Log validated availability
        console.log("Chef availability validated:", availability);

        // Proceed with booking creation
        const bookingResult = await pool.query(
            `INSERT INTO bookings (user_id, chef_id, booking_date, start_time, end_time, service_type, rate, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
            [user_id, chef_id, bookingDateUTC, startTimeUTC, endTimeUTC, service_type, rate]
        );

        const booking = bookingResult.rows[0];
        console.log("Booking created:", booking);

        // Update chef's availability
        const availabilityStartTime = moment.utc(availability.start_time, 'HH:mm:ss');
        const availabilityEndTime = moment.utc(availability.end_time, 'HH:mm:ss');
        const bookingStartTime = moment.utc(startTimeUTC, 'HH:mm:ss');
        const bookingEndTime = moment.utc(endTimeUTC, 'HH:mm:ss');

        await pool.query(
            `DELETE FROM chef_availability WHERE chef_id = $1 AND available_date = $2 
             AND start_time = $3 AND end_time = $4`,
            [chef_id, bookingDateUTC, availability.start_time, availability.end_time]
        );

        if (availabilityStartTime.isBefore(bookingStartTime)) {
            await pool.query(
                `INSERT INTO chef_availability (chef_id, available_date, start_time, end_time, online_rate, offline_rate) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [chef_id, bookingDateUTC, availability.start_time, startTimeUTC, availability.online_rate, availability.offline_rate]
            );
        }

        if (availabilityEndTime.isAfter(bookingEndTime)) {
            await pool.query(
                `INSERT INTO chef_availability (chef_id, available_date, start_time, end_time, online_rate, offline_rate) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [chef_id, bookingDateUTC, endTimeUTC, availability.end_time, availability.online_rate, availability.offline_rate]
            );
        }

        res.status(201).json({ message: 'Booking initiated successfully', booking });
    } catch (error) {
        console.error('Error initiating booking:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

// Cancel a booking
exports.cancelBooking = async (req, res) => {
    const { booking_id } = req.params;
    const user_id = req.user.id;
    const userRole = req.user.role;
    const userTimezone = req.header('Timezone') || 'UTC';

    try {
        // Retrieve booking details
        const bookingResult = await pool.query(
            `SELECT * FROM bookings WHERE id = $1`,
            [booking_id]
        );

        const booking = bookingResult.rows[0];
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Authorization check
        if (userRole !== 'admin' && booking.user_id !== user_id && booking.chef_id !== user_id) {
            return res.status(403).json({ message: 'Unauthorized to cancel this booking' });
        }

        // Check cancellation timing
        const currentUTC = moment().utc();
        const bookingStartUTC = moment.utc(`${booking.booking_date} ${booking.start_time}`, 'YYYY-MM-DD HH:mm:ss');
        const timeDifference = bookingStartUTC.diff(currentUTC, 'hours');

        if (timeDifference < 3 && userRole !== 'admin') {
            return res.status(400).json({ message: 'Cancellation is only allowed more than 3 hours before the booking start time' });
        }

        // Cancel the booking
        await pool.query(`DELETE FROM bookings WHERE id = $1`, [booking_id]);

        // Restore chef availability
        await pool.query(
            `INSERT INTO chef_availability (chef_id, available_date, start_time, end_time, online_rate, offline_rate) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [booking.chef_id, booking.booking_date, booking.start_time, booking.end_time, 
             booking.service_type === 'online' ? booking.rate : null, 
             booking.service_type === 'offline' ? booking.rate : null]
        );

        res.status(200).json({ message: 'Booking canceled successfully' });
    } catch (error) {
        console.error('Error canceling booking:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};
