const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Send booking confirmation email
exports.sendBookingConfirmation = async (userEmail, bookingDetails) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: `Your Booking with ${bookingDetails.chefName} is Confirmed`,
        text: `Dear ${bookingDetails.userName},

We are pleased to confirm your booking with ${bookingDetails.chefName} on ${bookingDetails.bookingDate} from ${bookingDetails.startTime} to ${bookingDetails.endTime}.

We look forward to serving you a delightful culinary experience.

If you have any questions or require further assistance, please don't hesitate to contact us.

Sincerely,
Recipe Mania`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Booking confirmation email sent');
    } catch (error) {
        console.error("Failed to send email:", error);
    }
};
