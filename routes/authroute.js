// routes/authroute.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const authController = require('../controllers/authcontroller');
const roleMiddleware = require('../middlewares/roleMiddleware');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

// Signup route
router.post('/signup', authController.signup);

// Login route
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// Routes for admins only
router.delete('/admin/users/:userId', authMiddleware, roleMiddleware(['admin']), authController.deleteUser);

module.exports = router;
