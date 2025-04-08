-- Create database
CREATE DATABASE IF NOT EXISTS food_toxins_db;
USE food_toxins_db;

-- Users table for authentication
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,  -- Will store hashed passwords
  email VARCHAR(100) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Foods table
CREATE TABLE foods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  serving_size VARCHAR(50) NOT NULL,  -- e.g., "100g" or "1 cup"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Toxins table
CREATE TABLE toxins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  daily_value DECIMAL(10, 4),  -- Maximum safe daily intake
  unit VARCHAR(20) NOT NULL,  -- e.g., "mg", "μg", etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Food-Toxin relationships (junction table)
CREATE TABLE food_toxins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  food_id INT NOT NULL,
  toxin_id INT NOT NULL,
  amount DECIMAL(10, 4) NOT NULL,  -- Amount per serving
  FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE,
  FOREIGN KEY (toxin_id) REFERENCES toxins(id) ON DELETE CASCADE,
  UNIQUE KEY food_toxin_unique (food_id, toxin_id),  -- Each food-toxin pair should be unique
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);