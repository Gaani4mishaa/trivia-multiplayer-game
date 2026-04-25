const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const db = new Database('./trivia.db');
const SECRET_KEY = 'your-secret-key-change-this-for-production';

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    total_score INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create scores table
db.exec(`
  CREATE TABLE IF NOT EXISTS game_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    score INTEGER,
    category TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`);

// Register user
function registerUser(username, email, password, callback) {
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
    const info = stmt.run(username, email, hashedPassword);
    const token = jwt.sign({ id: info.lastInsertRowid, username }, SECRET_KEY, { expiresIn: '7d' });
    callback(null, { token, user: { id: info.lastInsertRowid, username, email } });
  } catch (err) {
    callback(err);
  }
}

// Login user
function loginUser(email, password, callback) {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email);
    if (!user) return callback(new Error('User not found'));
    
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) return callback(new Error('Invalid password'));
    
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' });
    callback(null, { token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    callback(err);
  }
}

// Save game score
function saveScore(userId, score, category, callback) {
  try {
    const stmt = db.prepare('INSERT INTO game_scores (user_id, score, category) VALUES (?, ?, ?)');
    stmt.run(userId, score, category);
    const updateStmt = db.prepare('UPDATE users SET total_score = total_score + ?, games_played = games_played + 1 WHERE id = ?');
    updateStmt.run(score, userId);
    callback(null);
  } catch (err) {
    callback(err);
  }
}

// Get leaderboard
function getLeaderboard(limit = 10, callback) {
  try {
    const stmt = db.prepare(`
      SELECT username, total_score, games_played, games_won 
      FROM users 
      ORDER BY total_score DESC 
      LIMIT ?
    `);
    const rows = stmt.all(limit);
    callback(null, rows);
  } catch (err) {
    callback(err);
  }
}

// Get user stats
function getUserStats(userId, callback) {
  try {
    const stmt = db.prepare('SELECT total_score, games_played, games_won FROM users WHERE id = ?');
    const row = stmt.get(userId);
    callback(null, row);
  } catch (err) {
    callback(err);
  }
}

// Verify token
function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch (err) {
    return null;
  }
}

module.exports = { registerUser, loginUser, saveScore, getLeaderboard, getUserStats, verifyToken, db };