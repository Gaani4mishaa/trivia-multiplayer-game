const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const db = new sqlite3.Database('./trivia.db');
const SECRET_KEY = 'your-secret-key-change-this';

// Create users table if not exists
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password TEXT,
  total_score INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Create scores table
db.run(`CREATE TABLE IF NOT EXISTS game_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  score INTEGER,
  category TEXT,
  date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

// Register user
function registerUser(username, email, password, callback) {
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run(
    'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
    [username, email, hashedPassword],
    function(err) {
      if (err) return callback(err);
      const token = jwt.sign({ id: this.lastID, username }, SECRET_KEY, { expiresIn: '7d' });
      callback(null, { token, user: { id: this.lastID, username, email } });
    }
  );
}

// Login user
function loginUser(email, password, callback) {
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user) return callback(new Error('User not found'));
    
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) return callback(new Error('Invalid password'));
    
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' });
    callback(null, { token, user: { id: user.id, username: user.username, email: user.email } });
  });
}

// Save game score
function saveScore(userId, score, category, callback) {
  db.run(
    'INSERT INTO game_scores (user_id, score, category) VALUES (?, ?, ?)',
    [userId, score, category],
    (err) => {
      if (err) return callback(err);
      db.run('UPDATE users SET total_score = total_score + ?, games_played = games_played + 1 WHERE id = ?', [score, userId]);
      callback(null);
    }
  );
}

// Get leaderboard
function getLeaderboard(limit = 10, callback) {
  db.all(
    `SELECT username, total_score, games_played, games_won 
     FROM users 
     ORDER BY total_score DESC 
     LIMIT ?`,
    [limit],
    callback
  );
}

// Get user stats
function getUserStats(userId, callback) {
  db.get(
    `SELECT total_score, games_played, games_won 
     FROM users WHERE id = ?`,
    [userId],
    callback
  );
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