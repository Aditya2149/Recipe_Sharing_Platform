const Stripe = require("stripe");
const pool = require("../config/db");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const { sendBookingConfirmation } = require("./notificationcontroller");
const moment = require("moment-timezone");

// Calculate dynamic pricing based on day and duration
function calculatePricing(baseRate, bookingDate, hours) {
  const dayOfWeek = moment(bookingDate).day();
  let rate = baseRate;

  // Apply weekend rate multiplier
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    rate *= 1.25; // Weekend rate
  }

  // Calculate total price based on hours booked
  return rate * hours;
}

// Process payment and finalize booking
exports.processPayment = async (req, res) => {
  const { bookingId, baseRate, bookingDate, start_time, end_time } = req.body;

  try {
    // Calculate number of hours booked
    const start = moment(`${bookingDate} ${start_time}`, "YYYY-MM-DD HH:mm");
    const end = moment(`${bookingDate} ${end_time}`, "YYYY-MM-DD HH:mm");
    const duration = moment.duration(end.diff(start));
    const hours = duration.asHours();

    console.log("hours:", hours); // Output: 2
    if (hours <= 0) {
      return res.status(400).json({ error: "Invalid booking hours" });
    }

    // Calculate total price
    const price = calculatePricing(baseRate, bookingDate, hours) * 100; // Convert to cents for Stripe

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price),
      currency: "usd",
      payment_method_types: ["card"],
    });

    // Update booking with paymentIntentId
    await pool.query(
      "UPDATE bookings SET payment_intent_id = $1 WHERE id = $2",
      [paymentIntent.id, bookingId]
    );

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      price,
    });
  } catch (error) {
    console.error("Payment processing error:", error);
    res.status(500).json({ error: "Payment processing failed" });
  }
};

// Confirm booking and send confirmation
exports.confirmBooking = async (req, res) => {
  const { bookingId, paymentIntentId } = req.body;
  const userTimezone = req.headers["timezone"] || "UTC"; // Default to UTC if not provided

  try {
    // Fetch booking details, user email, chef name, and user's name
    const bookingResult = await pool.query(
      `SELECT b.*, 
                    u.email AS user_email, 
                    u.name AS user_name, 
                    c.name AS chef_name 
             FROM bookings b
             JOIN users u ON b.user_id = u.id
             JOIN users c ON b.chef_id = c.id
             WHERE b.id = $1`,
      [bookingId]
    );

    const booking = bookingResult.rows[0];
    if (!booking) {
      console.error("Booking not found for ID:", bookingId);
      return res.status(404).json({ message: "Booking not found" });
    }

    // Debug raw values
    console.log("Raw Booking Date:", booking.booking_date);
    console.log("Raw Start Time:", booking.start_time);
    console.log("Raw End Time:", booking.end_time);
    console.log("User Timezone:", userTimezone);

    // Confirm the booking
    const updateQuery = `
            UPDATE bookings 
            SET status = 'Confirmed', payment_intent_id = $1 
            WHERE id = $2 RETURNING *;
        `;
    const updateResult = await pool.query(updateQuery, [
      paymentIntentId,
      bookingId,
    ]);
    const updatedBooking = updateResult.rows[0];

    // Convert times to user's timezone
    const bookingDate = moment(booking.booking_date)
      .tz(userTimezone)
      .format("YYYY-MM-DD");
    // Combine and parse the `booking_date` with `start_time` and `end_time` as UTC
    const startTime = moment
      .utc(
        `${moment(booking.booking_date).format("YYYY-MM-DD")} ${
          booking.start_time
        }`,
        "YYYY-MM-DD HH:mm:ss"
      )
      .tz(userTimezone)
      .format("hh:mm A");

    const endTime = moment
      .utc(
        `${moment(booking.booking_date).format("YYYY-MM-DD")} ${
          booking.end_time
        }`,
        "YYYY-MM-DD HH:mm:ss"
      )
      .tz(userTimezone)
      .format("hh:mm A");

    console.log("Converted Start Time:", startTime);
    console.log("Converted End Time:", endTime);

    // Prepare booking details for email
    const bookingDetails = {
      userName: booking.user_name,
      chefName: booking.chef_name,
      bookingDate,
      startTime,
      endTime,
    };

    // Send booking confirmation email
    await sendBookingConfirmation(booking.user_email, bookingDetails);

    res.status(200).json({
      message: "Booking confirmed successfully",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Error confirming booking:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
};
