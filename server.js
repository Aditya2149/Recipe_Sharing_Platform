// server.js
const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authroute');
const recipeRoutes = require('./routes/reciperoute')
const reviewRoutes = require('./routes/reviewroute');
require('dotenv').config();

// Initialize Express app
const app = express();

// Middleware for parsing request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

//auth route
app.use('/auth', authRoutes);
app.use('/recipes',recipeRoutes);

// Review routes
app.use('/reviews', reviewRoutes);


// Set up the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});