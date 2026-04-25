const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const auth = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const questions = [
  { id: 1, text: "What is the capital of France?", options: ["London", "Berlin", "Paris", "Madrid"], correct: 2, category: "General", points: 10 },
  { id: 2, text: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correct: 3, category: "General", points: 10 },
  { id: 3, text: "Who painted the Mona Lisa?", options: ["Van Gogh", "Picasso", "da Vinci", "Rembrandt"], correct: 2, category: "General", points: 15 },
  { id: 4, text: "Which planet is known as the Red Planet?", options: ["Jupiter", "Mars", "Venus", "Saturn"], correct: 1, category: "General", points: 10 },
  { id: 5, text: "What is H2O commonly known as?", options: ["Oxygen", "Salt", "Water", "Hydrogen"], correct: 2, category: "Science", points: 10 },
  { id: 6, text: "What is the speed of light?", options: ["300 km/s", "300,000 km/s", "3,000 km/s", "30,000 km/s"], correct: 1, category: "Science", points: 15 },
  { id: 7, text: "Which organ pumps blood through the body?", options: ["Brain", "Liver", "Heart", "Lungs"], correct: 2, category: "Science", points: 10 },
  { id: 8, text: "Who was the first President of the United States?", options: ["John Adams", "Thomas Jefferson", "George Washington", "Benjamin Franklin"], correct: 2, category: "History", points: 10 },
  { id: 9, text: "In which year did World War II end?", options: ["1943", "1944", "1945", "1946"], correct: 2, category: "History", points: 10 },
  { id: 10, text: "Who painted the Sistine Chapel ceiling?", options: ["Donatello", "Raphael", "Michelangelo", "Leonardo"], correct: 2, category: "History", points: 15 },
  { id: 11, text: "How many players are on a basketball team on the court?", options: ["4", "5", "6", "7"], correct: 1, category: "Sports", points: 10 },
  { id: 12, text: "Who has won the most Ballon d'Or awards?", options: ["Ronaldo", "Messi", "Neymar", "Mbappe"], correct: 1, category: "Sports", points: 10 },
  { id: 13, text: "Which country won the FIFA World Cup in 2018?", options: ["Germany", "Brazil", "France", "Argentina"], correct: 2, category: "Sports", points: 10 },
  { id: 14, text: "Who played Jack Dawson in Titanic?", options: ["Brad Pitt", "Leonardo DiCaprio", "Johnny Depp", "Matt Damon"], correct: 1, category: "Entertainment", points: 10 },
  { id: 15, text: "Which band performed 'Bohemian Rhapsody'?", options: ["The Beatles", "Queen", "Led Zeppelin", "Pink Floyd"], correct: 1, category: "Entertainment", points: 10 }
];

// Auth API routes
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;
  auth.registerUser(username, email, password, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json(result);
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  auth.loginUser(email, password, (err, result) => {
    if (err) return res.status(401).json({ error: err.message });
    res.json(result);
  });
});

app.get('/api/leaderboard', (req, res) => {
  auth.getLeaderboard(10, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Game state
let players = {};
let gameActive = false;
let currentQuestionIndex = 0;
let scores = {};
let currentCategory = "All";

io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);
  
  socket.on('joinGame', (data) => {
    const { playerName, token } = data;
    let userId = null;
    
    if (token) {
      const decoded = auth.verifyToken(token);
      if (decoded) userId = decoded.id;
    }
    
    players[socket.id] = { 
      id: socket.id, 
      name: playerName, 
      score: 0, 
      startTime: Date.now(),
      userId: userId
    };
    scores[socket.id] = 0;
    console.log(`${playerName} joined the game`);
    
    socket.emit('gameJoined', { playerId: socket.id, playerName });
    io.emit('playersUpdate', Object.values(players));
    socket.emit('categories', [...new Set(questions.map(q => q.category))]);
  });
  
  socket.on('selectCategory', (category) => {
    currentCategory = category;
    io.emit('categorySelected', category);
  });
  
  socket.on('startGame', () => {
    if (!gameActive) {
      gameActive = true;
      currentQuestionIndex = 0;
      Object.keys(scores).forEach(id => scores[id] = 0);
      sendQuestion();
    }
  });
  
  function getFilteredQuestions() {
    if (currentCategory === "All") return questions;
    return questions.filter(q => q.category === currentCategory);
  }
  
  function sendQuestion() {
    const filtered = getFilteredQuestions();
    if (currentQuestionIndex >= filtered.length) {
      endGame();
      return;
    }
    const question = filtered[currentQuestionIndex];
    io.emit('newQuestion', {
      question: question.text,
      options: question.options,
      category: question.category,
      questionNumber: currentQuestionIndex + 1,
      totalQuestions: filtered.length
    });
  }
  
  socket.on('submitAnswer', (data) => {
    const { answerIndex, timeTaken } = data;
    const filtered = getFilteredQuestions();
    const question = filtered[currentQuestionIndex];
    if (!question) return;
    
    const isCorrect = (answerIndex === question.correct);
    
    if (isCorrect) {
      let points = question.points;
      const speedBonus = Math.max(0, Math.floor((15 - timeTaken) / 3));
      const totalPoints = points + speedBonus;
      scores[socket.id] = (scores[socket.id] || 0) + totalPoints;
      if (players[socket.id]) players[socket.id].score = scores[socket.id];
      
      socket.emit('answerResult', { correct: true, points: totalPoints, message: `✅ Correct! +${totalPoints} points!` });
    } else {
      socket.emit('answerResult', { correct: false, points: 0, message: `❌ Wrong! Answer: ${question.options[question.correct]}` });
    }
    
    io.emit('playersUpdate', Object.values(players));
    
    setTimeout(() => {
      currentQuestionIndex++;
      if (currentQuestionIndex < filtered.length) {
        sendQuestion();
      } else {
        endGame();
      }
    }, 2000);
  });
  
  function endGame() {
    gameActive = false;
    const finalScores = Object.values(players).map(p => ({
      name: p.name,
      score: scores[p.id] || 0,
      timeElapsed: Math.floor((Date.now() - p.startTime) / 1000),
      userId: p.userId
    }));
    finalScores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.timeElapsed - b.timeElapsed;
    });
    
    // Save scores for logged-in users
    finalScores.forEach(player => {
      if (player.userId && player.score > 0) {
        auth.saveScore(player.userId, player.score, currentCategory, (err) => {
          if (err) console.log('Error saving score:', err);
        });
      }
    });
    
    io.emit('gameEnd', { leaderboard: finalScores });
  }
  
  socket.on('disconnect', () => {
    delete players[socket.id];
    delete scores[socket.id];
    io.emit('playersUpdate', Object.values(players));
    console.log('Player disconnected');
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Questions loaded: ${questions.length}`);
});