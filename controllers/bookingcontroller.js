const pool = require('../config/db');
const moment = require('moment-timezone');

// Create a new booking with timezone handling and partial booking logic
exports.createBooking = async (req, res) => {
    const { chef_id, booking_date, start_time, end_time, service_type } = req.body;
    const user_id = req.user.id;
    const userTimezone = req.header('Timezone') || 'UTC';

    try {
        // Combine date and time for conversion to UTC
        const utcStartDateTime = moment.tz(`${booking_date} ${start_time}`, userTimezone).utc();
        const utcEndDateTime = moment.tz(`${booking_date} ${end_time}`, userTimezone).utc();

        // Extract UTC components for comparison with database
        const bookingDateUTC = utcStartDateTime.format('YYYY-MM-DD');
        const startTimeUTC = utcStartDateTime.format('HH:mm:ss');
        const endTimeUTC = utcEndDateTime.format('HH:mm:ss');

        console.log("Converted booking times to UTC:");
        console.log("Booking Date (UTC):", bookingDateUTC);
        console.log("Start Time (UTC):", startTimeUTC);
        console.log("End Time (UTC):", endTimeUTC);

        // Query for chef's availability in UTC
        const availabilityResult = await pool.query(
            `SELECT * FROM chef_availability WHERE chef_id = $1 AND available_date = $2 
             AND start_time <= $3 AND end_time >= $4`,
            [chef_id, bookingDateUTC, startTimeUTC, endTimeUTC]
        );

        const availability = availabilityResult.rows[0];
        console.log("Chef availability query result:", availability);

        if (!availability) {
            return res.status(400).json({ message: 'Selected time slot is not available' });
        }

        // Determine rate based on service type (online or offline)
        const rate = service_type === 'online' ? availability.online_rate : availability.offline_rate;
        if (!rate) {
            return res.status(400).json({ message: `No rate set for ${service_type} service` });
        }

        // Create the booking
        const bookingResult = await pool.query(
            `INSERT INTO bookings (user_id, chef_id, booking_date, start_time, end_time, service_type, rate) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [user_id, chef_id, bookingDateUTC, startTimeUTC, endTimeUTC, service_type, rate]
        );

        const booking = bookingResult.rows[0];
        console.log("Booking created:", booking);

        // Adjust availability for partial bookings
        const availabilityStartTime = moment.utc(availability.start_time, 'HH:mm:ss');
        const availabilityEndTime = moment.utc(availability.end_time, 'HH:mm:ss');
        const bookingStartTime = moment.utc(startTimeUTC, 'HH:mm:ss');
        const bookingEndTime = moment.utc(endTimeUTC, 'HH:mm:ss');

        console.log("Availability start time:", availabilityStartTime.format('HH:mm:ss'));
        console.log("Availability end time:", availabilityEndTime.format('HH:mm:ss'));
        console.log("Booking start time:", bookingStartTime.format('HH:mm:ss'));
        console.log("Booking end time:", bookingEndTime.format('HH:mm:ss'));

        // Remove or adjust availability based on booking
        if (availabilityStartTime.isSame(bookingStartTime) && availabilityEndTime.isSame(bookingEndTime)) {
            console.log("Full slot match: deleting availability slot");
            await pool.query(
                `DELETE FROM chef_availability WHERE chef_id = $1 AND available_date = $2 
                 AND start_time = $3 AND end_time = $4`,
                [chef_id, bookingDateUTC, availability.start_time, availability.end_time]
            );
        } else {
            console.log("Partial booking detected, updating availability slots");

            await pool.query(
                `DELETE FROM chef_availability WHERE chef_id = $1 AND available_date = $2 
                 AND start_time = $3 AND end_time = $4`,
                [chef_id, bookingDateUTC, availability.start_time, availability.end_time]
            );

            // Add remaining slots if applicable
            if (availabilityStartTime.isBefore(bookingStartTime)) {
                console.log("Inserting slot before booking start time");
                await pool.query(
                    `INSERT INTO chef_availability (chef_id, available_date, start_time, end_time, online_rate, offline_rate) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [chef_id, bookingDateUTC, availability.start_time, startTimeUTC, availability.online_rate, availability.offline_rate]
                );
            }
            if (availabilityEndTime.isAfter(bookingEndTime)) {
                console.log("Inserting slot after booking end time");
                await pool.query(
                    `INSERT INTO chef_availability (chef_id, available_date, start_time, end_time, online_rate, offline_rate) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [chef_id, bookingDateUTC, endTimeUTC, availability.end_time, availability.online_rate, availability.offline_rate]
                );
            }
        }

        res.status(201).json({ message: 'Booking created successfully', booking });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};


// Cancel a booking
exports.cancelBooking = async (req, res) => {
    const { booking_id } = req.params;
    const user_id = req.user.id;
    const userRole = req.user.role;  // User role ('user', 'chef', or 'admin')
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

        // Check if user is authorized to cancel the booking
        if (userRole !== 'admin' && booking.user_id !== user_id && booking.chef_id !== user_id) {
            return res.status(403).json({ message: 'Unauthorized to cancel this booking' });
        }

        // Convert current time to UTC
        const currentUTC = moment().utc();
        const bookingStartUTC = moment.utc(`${booking.booking_date} ${booking.start_time}`, 'YYYY-MM-DD HH:mm:ss');

        // Check if cancellation is allowed (at least 3 hours before booking start)
        const timeDifference = bookingStartUTC.diff(currentUTC, 'hours');

        if (timeDifference < 3 && userRole !== 'admin') {
            return res.status(400).json({ message: 'Cancellation is only allowed more than 3 hours before the booking start time' });
        }

        // Delete booking from bookings table
        await pool.query(
            `DELETE FROM bookings WHERE id = $1`,
            [booking_id]
        );
        console.log("Booking deleted successfully");

        // Restore chef's availability for the canceled time slot
        await pool.query(
            `INSERT INTO chef_availability (chef_id, available_date, start_time, end_time, online_rate, offline_rate) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [booking.chef_id, booking.booking_date, booking.start_time, booking.end_time, booking.service_type === 'online' ? booking.rate : null, booking.service_type === 'offline' ? booking.rate : null]
        );

        res.status(200).json({ message: 'Booking canceled successfully' });
    } catch (error) {
        console.error('Error canceling booking:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
};
