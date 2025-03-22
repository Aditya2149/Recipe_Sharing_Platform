const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authroute');
const recipeRoutes = require('./routes/reciperoute');
const reviewRoutes = require('./routes/reviewroute');
const chefAvailabilityRoutes = require('./routes/chefavailroute');
const bookingRoutes = require('./routes/bookingroute');
const paymentRoutes = require('./routes/paymentroute');
const chefProfileRoutes = require('./routes/chefprofileroute');
const userDashboardRoutes = require('./routes/userdashboardroute');
const chatRoutes = require('./routes/chatroute'); // Import chat routes
const shoppingListRoutes = require('./routes/shoppinglistroute');


// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

const cors = require("cors");
app.use(
    cors({
        origin: "*", // Allow only your frontend
        methods: "GET,POST,PUT,DELETE",
        allowedHeaders: "Content-Type,Authorization",
    })
);
// Initialize Socket.IO
const io = new Server(server);

// Middleware for session management
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }, // Set to true if using HTTPS
});
app.use(sessionMiddleware);

// Share session with Socket.IO
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Middleware for parsing request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Define routes
app.use('/auth', authRoutes);
app.use('/recipes', recipeRoutes);
app.use('/reviews', reviewRoutes);
app.use('/availability', chefAvailabilityRoutes);
app.use('/bookings', bookingRoutes);
app.use('/payments', paymentRoutes);
app.use('/chef-profile', chefProfileRoutes);
app.use('/dashboard', userDashboardRoutes);
app.use('/chat', chatRoutes); // Add chat routes
app.use('/shopping-list', shoppingListRoutes);

// Socket.IO event handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Join a specific chat room based on booking ID
  socket.on('joinRoom', ({ bookingId, userId }) => {
    const room = `booking_${bookingId}`;
    socket.join(room);
    console.log(`User ${userId} joined room: ${room}`);
  });

  // Handle sending messages
  socket.on('sendMessage', async ({ bookingId, senderId, receiverId, message }) => {
    const room = `booking_${bookingId}`;
    try {
      // Save message to database (requires pool configured in `config/db.js`)
      await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, booking_id, message) VALUES ($1, $2, $3, $4)`,
        [senderId, receiverId, bookingId, message]
      );

      // Emit message to all participants in the room
      io.to(room).emit('receiveMessage', {
        senderId,
        message,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});

// Set up the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
