// config/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
      rejectUnauthorized: false, // This may be necessary for self-signed certificates
      ca: process.env.DB_SSL_CA
    }
});

pool.connect(async (err, client, release) => {
    if (err) {
        console.error('Error connecting to Aiven database:', err);
    } else {
        console.log('Connected to Aiven database!');
        
        try {
            // Queries to create tables if they don't exist
            const createUserTableQuery = `
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password VARCHAR(100) NOT NULL,
                    role VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `;

            const createCategoriesTableQuery = `
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL
            );
            `;

            const createRecipeTableQuery = `
            CREATE TABLE IF NOT EXISTS recipes (
                id SERIAL PRIMARY KEY,
                chef_id INTEGER REFERENCES users(id), -- Foreign key to the users table
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                category_id INTEGER REFERENCES categories(id),
                image_url VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            `;

            const createIngredientsTableQuery = `
            CREATE TABLE IF NOT EXISTS ingredients (
                id SERIAL PRIMARY KEY,
                recipe_id INTEGER REFERENCES recipes(id),
                name VARCHAR(255) NOT NULL,
                quantity VARCHAR(50) NOT NULL
            );
            `;
            const createStepsTableQuery = `
            CREATE TABLE IF NOT EXISTS steps (
                id SERIAL PRIMARY KEY,
                recipe_id INTEGER REFERENCES recipes(id),
                step_number INTEGER NOT NULL,
                description TEXT NOT NULL
            );
            `;


            await client.query(createUserTableQuery);
            await client.query(createCategoriesTableQuery);
            await client.query(createRecipeTableQuery);
            await client.query(createIngredientsTableQuery);
            await client.query(createStepsTableQuery);
            console.log("Tables are ensured to exist in the database.");

        } catch (tableErr) {
            console.error("Error creating tables:", tableErr);
        } finally {
            release();  // Release the client back to the pool
        }
    }
});

module.exports = pool;
