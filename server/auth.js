const initSqlJs = require('sql.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

let db;
const SECRET_KEY = 'your-secret-key-change-this-for-production';

// Initialize database
async function initDB() {
  const SQL = await initSqlJs();
  
  // Check if database file exists
  let dbData = null;
  if (fs.existsSync('./trivia.db')) {
    dbData = fs.readFileSync('./trivia.db');
  }
  
  db = new SQL.Database(dbData);
  
  // Create tables
  db.run(`
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
  
  db.run(`
    CREATE TABLE IF NOT EXISTS game_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      score INTEGER,
      category TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
  
  saveDB();
  console.log('Database initialized');
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync('./trivia.db', Buffer.from(data));
}

// Register user
async function registerUser(username, email, password, callback) {
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
    stmt.run([username, email, hashedPassword]);
    saveDB();
    
    // Get the last insert ID
    const idStmt = db.prepare('SELECT last_insert_rowid() as id');
    const result = idStmt.get();
    const userId = result.id;
    
    const token = jwt.sign({ id: userId, username }, SECRET_KEY, { expiresIn: '7d' });
    callback(null, { token, user: { id: userId, username, email } });
  } catch (err) {
    callback(err);
  }
}

// Login user
async function loginUser(email, password, callback) {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get([email]);
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
async function saveScore(userId, score, category, callback) {
  try {
    const stmt = db.prepare('INSERT INTO game_scores (user_id, score, category) VALUES (?, ?, ?)');
    stmt.run([userId, score, category]);
    const updateStmt = db.prepare('UPDATE users SET total_score = total_score + ?, games_played = games_played + 1 WHERE id = ?');
    updateStmt.run([score, userId]);
    saveDB();
    callback(null);
  } catch (err) {
    callback(err);
  }
}

// Get leaderboard
async function getLeaderboard(limit = 10, callback) {
  try {
    const stmt = db.prepare(`
      SELECT username, total_score, games_played, games_won 
      FROM users 
      ORDER BY total_score DESC 
      LIMIT ?
    `);
    const rows = stmt.get([limit]);
    callback(null, rows || []);
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

// Export and initialize
initDB();

module.exports = { registerUser, loginUser, saveScore, getLeaderboard, verifyToken, initDB };