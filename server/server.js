// server.js - Main entry point for the Food Toxin Tracker API
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'food_toxins_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Authentication middleware
const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed' });
  }
};

// AUTH ROUTES
// Register a new user
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { id: result.insertId, username, role: 'admin' },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1d' }
    );
    
    res.status(201).json({
      message: 'User registered successfully',
      token
    });
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Find user by username
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    
    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const user = users[0];
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1d' }
    );
    
    res.json({
      message: 'Login successful',
      token
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(users[0]);
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// FOOD ROUTES
// Get all foods
app.get('/api/foods', async (req, res) => {
  try {
    const [foods] = await pool.query('SELECT * FROM foods ORDER BY name');
    res.json(foods);
  } catch (error) {
    console.error('Error in getAllFoods:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single food by ID with its toxins
app.get('/api/foods/:id', async (req, res) => {
  try {
    const [foods] = await pool.query('SELECT * FROM foods WHERE id = ?', [req.params.id]);
    
    if (foods.length === 0) {
      return res.status(404).json({ message: 'Food not found' });
    }
    
    const food = foods[0];
    
    // Get toxins for this food
    const [toxins] = await pool.query(`
      SELECT t.id, t.name, t.description, t.daily_value, t.unit, ft.amount
      FROM toxins t
      JOIN food_toxins ft ON t.id = ft.toxin_id
      WHERE ft.food_id = ?
    `, [req.params.id]);
    
    food.toxins = toxins;
    
    res.json(food);
  } catch (error) {
    console.error('Error in getFoodById:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search for foods by name
app.get('/api/foods/search', async (req, res) => {
  const { query } = req.query;
  
  try {
    const [foods] = await pool.query(
      'SELECT * FROM foods WHERE name LIKE ? ORDER BY name',
      [`%${query}%`]
    );
    
    res.json(foods);
  } catch (error) {
    console.error('Error in searchFoods:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new food (protected)
app.post('/api/foods', auth, async (req, res) => {
  const { name, description, serving_size, toxins } = req.body;
  
  try {
    // Start a transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Insert the food
      const [foodResult] = await connection.query(
        'INSERT INTO foods (name, description, serving_size) VALUES (?, ?, ?)',
        [name, description, serving_size]
      );
      
      const foodId = foodResult.insertId;
      
      // Insert the toxins
      if (toxins && toxins.length > 0) {
        const toxinValues = toxins.map(toxin => [foodId, toxin.toxin_id, toxin.amount]);
        
        await connection.query(
          'INSERT INTO food_toxins (food_id, toxin_id, amount) VALUES ?',
          [toxinValues]
        );
      }
      
      await connection.commit();
      
      res.status(201).json({
        message: 'Food created successfully',
        foodId
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error in createFood:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a food (protected)
app.put('/api/foods/:id', auth, async (req, res) => {
  const { name, description, serving_size, toxins } = req.body;
  const foodId = req.params.id;
  
  try {
    // Start a transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Update the food
      await connection.query(
        'UPDATE foods SET name = ?, description = ?, serving_size = ? WHERE id = ?',
        [name, description, serving_size, foodId]
      );
      
      // Delete existing toxin relationships
      await connection.query('DELETE FROM food_toxins WHERE food_id = ?', [foodId]);
      
      // Insert the updated toxins
      if (toxins && toxins.length > 0) {
        const toxinValues = toxins.map(toxin => [foodId, toxin.toxin_id, toxin.amount]);
        
        await connection.query(
          'INSERT INTO food_toxins (food_id, toxin_id, amount) VALUES ?',
          [toxinValues]
        );
      }
      
      await connection.commit();
      
      res.json({
        message: 'Food updated successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error in updateFood:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a food (protected)
app.delete('/api/foods/:id', auth, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM foods WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Food not found' });
    }
    
    res.json({ message: 'Food deleted successfully' });
  } catch (error) {
    console.error('Error in deleteFood:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// TOXIN ROUTES
// Get all toxins
app.get('/api/toxins', async (req, res) => {
  try {
    const [toxins] = await pool.query('SELECT * FROM toxins ORDER BY name');
    res.json(toxins);
  } catch (error) {
    console.error('Error in getAllToxins:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single toxin by ID
app.get('/api/toxins/:id', async (req, res) => {
  try {
    const [toxins] = await pool.query('SELECT * FROM toxins WHERE id = ?', [req.params.id]);
    
    if (toxins.length === 0) {
      return res.status(404).json({ message: 'Toxin not found' });
    }
    
    res.json(toxins[0]);
  } catch (error) {
    console.error('Error in getToxinById:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new toxin (protected)
app.post('/api/toxins', auth, async (req, res) => {
  const { name, description, daily_value, unit } = req.body;
  
  try {
    const [result] = await pool.query(
      'INSERT INTO toxins (name, description, daily_value, unit) VALUES (?, ?, ?, ?)',
      [name, description, daily_value, unit]
    );
    
    res.status(201).json({
      message: 'Toxin created successfully',
      toxinId: result.insertId
    });
  } catch (error) {
    console.error('Error in createToxin:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a toxin (protected)
app.put('/api/toxins/:id', auth, async (req, res) => {
  const { name, description, daily_value, unit } = req.body;
  
  try {
    const [result] = await pool.query(
      'UPDATE toxins SET name = ?, description = ?, daily_value = ?, unit = ? WHERE id = ?',
      [name, description, daily_value, unit, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Toxin not found' });
    }
    
    res.json({ message: 'Toxin updated successfully' });
  } catch (error) {
    console.error('Error in updateToxin:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a toxin (protected)
app.delete('/api/toxins/:id', auth, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM toxins WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Toxin not found' });
    }
    
    res.json({ message: 'Toxin deleted successfully' });
  } catch (error) {
    console.error('Error in deleteToxin:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});