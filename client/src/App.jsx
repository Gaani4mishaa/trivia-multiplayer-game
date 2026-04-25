import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import confetti from 'canvas-confetti';

const socket = io('https://trivia-multiplayer-game.onrender.com');

function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(true);
  const [authError, setAuthError] = useState('');
  
  // Login/Register form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  
  // Game state
  const [playerName, setPlayerName] = useState('');
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [message, setMessage] = useState('');
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState(null);
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [timeLeft, setTimeLeft] = useState(15);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGlobalLeaderboard, setShowGlobalLeaderboard] = useState(false);
  const [userStats, setUserStats] = useState(null);
  
  // Audio refs
  const correctSound = useRef(null);
  const wrongSound = useRef(null);
  const winSound = useRef(null);
  const joinSound = useRef(null);

  // Create audio elements
  useEffect(() => {
    correctSound.current = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
    wrongSound.current = new Audio('https://www.soundjay.com/misc/sounds/buzzer-or-wrong-answer-02.mp3');
    winSound.current = new Audio('https://www.soundjay.com/misc/sounds/fanfare-6.mp3');
    joinSound.current = new Audio('https://www.soundjay.com/misc/sounds/doorbell.mp3');
  }, []);

  // Fetch global leaderboard
  const fetchGlobalLeaderboard = async () => {
    try {
      const res = await fetch('https://trivia-multiplayer-game.onrender.com/api/leaderboard');
      const data = await res.json();
      setGlobalLeaderboard(data);
    } catch (err) {
      console.log('Error fetching leaderboard:', err);
    }
  };

  useEffect(() => {
    fetchGlobalLeaderboard();
  }, []);

  // Fetch user stats if logged in
  useEffect(() => {
    if (token) {
      // You can add a /api/me endpoint to get user stats
      // For now, just set user from token
      setUser({ name: playerName || 'Player' });
    }
  }, [token]);

  // Socket event listeners
  useEffect(() => {
    socket.on('playersUpdate', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    socket.on('gameJoined', (data) => {
      setJoined(true);
      setMessage(`✨ Welcome ${data.playerName}! ✨`);
      playSound(joinSound);
    });

    socket.on('categories', (cats) => {
      setCategories(['All', ...cats]);
    });

    socket.on('categorySelected', (cat) => {
      setSelectedCategory(cat);
      setMessage(`📚 Category: ${cat}`);
    });

    socket.on('newQuestion', (data) => {
      setCurrentQuestion(data);
      setQuestionNumber(data.questionNumber);
      setTotalQuestions(data.totalQuestions);
      setAnswerLocked(false);
      setTimeLeft(15);
      setMessage('');
    });

    socket.on('answerResult', (data) => {
      setMessage(data.message);
      if (data.correct) {
        setScore(prev => prev + data.points);
        playSound(correctSound);
      } else {
        playSound(wrongSound);
      }
    });

    socket.on('gameEnd', (data) => {
      setGameStarted(false);
      setLeaderboard(data.leaderboard);
      setCurrentQuestion(null);
      fetchGlobalLeaderboard();
      
      const isWinner = data.leaderboard[0]?.name === playerName;
      if (isWinner) {
        playSound(winSound);
        triggerConfetti();
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    });

    return () => {
      socket.off('playersUpdate');
      socket.off('gameJoined');
      socket.off('categories');
      socket.off('categorySelected');
      socket.off('newQuestion');
      socket.off('answerResult');
      socket.off('gameEnd');
    };
  }, [playerName]);

  useEffect(() => {
    if (gameStarted && timeLeft > 0 && !answerLocked) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !answerLocked && gameStarted) {
      handleTimeout();
    }
  }, [timeLeft, gameStarted, answerLocked]);

  const playSound = (sound) => {
    if (soundEnabled && sound.current) {
      sound.current.currentTime = 0;
      sound.current.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  const triggerConfetti = () => {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    confetti({ particleCount: 100, spread: 100, origin: { y: 0.6, x: 0.2 }, colors: ['#667eea', '#764ba2'] });
    confetti({ particleCount: 100, spread: 100, origin: { y: 0.6, x: 0.8 }, colors: ['#f093fb', '#f5576c'] });
  };

  // Register function
  const handleRegister = async () => {
    try {
      const res = await fetch('https://trivia-multiplayer-game.onrender.com/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: regUsername, email: regEmail, password: regPassword })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        setAuthError('');
        setShowLogin(true);
      } else {
        setAuthError(data.error);
      }
    } catch (err) {
      setAuthError('Registration failed');
    }
  };

  // Login function
  const handleLogin = async () => {
    try {
      const res = await fetch('https://trivia-multiplayer-game.onrender.com/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        setAuthError('');
      } else {
        setAuthError(data.error);
      }
    } catch (err) {
      setAuthError('Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setJoined(false);
    setGameStarted(false);
    setLeaderboard(null);
  };

  const handleJoin = () => {
    if (playerName.trim()) {
      socket.emit('joinGame', { playerName, token });
    }
  };

  const handleSelectCategory = (category) => {
    setSelectedCategory(category);
    socket.emit('selectCategory', category);
  };

  const handleStartGame = () => {
    socket.emit('startGame');
    setGameStarted(true);
    setLeaderboard(null);
    setScore(0);
  };

  const handleAnswer = (answerIndex) => {
    if (answerLocked || !gameStarted) return;
    setAnswerLocked(true);
    const timeTaken = 15 - timeLeft;
    socket.emit('submitAnswer', { answerIndex, timeTaken });
  };

  const handleTimeout = () => {
    setAnswerLocked(true);
    socket.emit('submitAnswer', { answerIndex: -1, timeTaken: 15 });
    setMessage('⏰ Time\'s up!');
    playSound(wrongSound);
  };

  const toggleSound = () => setSoundEnabled(!soundEnabled);

  // Login/Register Screen
  if (!token) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>🎮 TRIVIA MASTERS</h1>
          <div style={styles.authToggle}>
            <button 
              onClick={() => { setShowLogin(true); setAuthError(''); }}
              style={{...styles.authTab, borderBottom: showLogin ? '2px solid #667eea' : 'none'}}
            >Login</button>
            <button 
              onClick={() => { setShowLogin(false); setAuthError(''); }}
              style={{...styles.authTab, borderBottom: !showLogin ? '2px solid #667eea' : 'none'}}
            >Register</button>
          </div>
          
          {showLogin ? (
            <div>
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                style={styles.input}
              />
              <input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={styles.input}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
              <button onClick={handleLogin} style={styles.button}>Login</button>
            </div>
          ) : (
            <div>
              <input
                type="text"
                placeholder="Username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                style={styles.input}
              />
              <input
                type="email"
                placeholder="Email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                style={styles.input}
              />
              <input
                type="password"
                placeholder="Password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                style={styles.input}
                onKeyPress={(e) => e.key === 'Enter' && handleRegister()}
              />
              <button onClick={handleRegister} style={styles.button}>Register</button>
            </div>
          )}
          {authError && <p style={styles.error}>{authError}</p>}
        </div>
      </div>
    );
  }

  // Name entry screen (after login)
  if (!joined) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.userHeader}>
            <span>👤 {user?.username || user?.email}</span>
            <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
          </div>
          <h1 style={styles.title}>🎮 TRIVIA MASTERS</h1>
          <input
            type="text"
            placeholder="Enter your game name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            style={styles.input}
            onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
          />
          <button onClick={handleJoin} style={styles.button}>Join Game →</button>
          <button onClick={() => setShowGlobalLeaderboard(!showGlobalLeaderboard)} style={styles.secondaryButton}>
            🏆 Global Leaderboard
          </button>
          
          {showGlobalLeaderboard && (
            <div style={styles.globalLeaderboard}>
              <h3>Top Players All Time</h3>
              {globalLeaderboard.map((p, idx) => (
                <div key={idx} style={styles.leaderboardRow}>
                  <span>{idx + 1}. {p.username}</span>
                  <span>{p.total_score} pts</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={toggleSound} style={styles.soundButton}>
            {soundEnabled ? '🔊 Sound On' : '🔇 Sound Off'}
          </button>
        </div>
      </div>
    );
  }

  // Game over screen
  if (leaderboard) {
    return (
      <div style={styles.container}>
        {showConfetti && <div style={styles.confettiOverlay} />}
        <div style={styles.card}>
          <h1 style={styles.title}>🏆 GAME OVER 🏆</h1>
          <h2>Final Rankings</h2>
          {leaderboard.map((player, idx) => (
            <div key={idx} style={{...styles.leaderboardRow, 
              background: idx === 0 ? '#FFD70020' : idx === 1 ? '#C0C0C020' : idx === 2 ? '#CD7F3220' : 'transparent',
              fontWeight: idx === 0 ? 'bold' : 'normal'}}>
              <span>{idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`} {player.name}</span>
              <span>{player.score} pts</span>
            </div>
          ))}
          <button onClick={() => window.location.reload()} style={styles.button}>Play Again 🔄</button>
        </div>
      </div>
    );
  }

  // Game screen
  return (
    <div style={styles.container}>
      <div style={styles.gameContainer}>
        <div style={styles.header}>
          <div>👥 {players.map(p => `${p.name} (${p.score})`).join(' • ')}</div>
          <div style={styles.scoreBadge}>⭐ {score} pts</div>
          <button onClick={toggleSound} style={styles.smallSoundBtn}>{soundEnabled ? '🔊' : '🔇'}</button>
          <button onClick={handleLogout} style={styles.smallLogoutBtn}>🚪</button>
        </div>

        {!gameStarted ? (
          <div style={styles.card}>
            <h2>🎯 Waiting Room</h2>
            <p>Players ready:</p>
            <ul style={styles.playerList}>
              {players.map(p => <li key={p.id}>🎮 {p.name}</li>)}
            </ul>
            {players.length > 0 && (
              <>
                <h3>📚 Select Category:</h3>
                <div style={styles.categoryGrid}>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => handleSelectCategory(cat)}
                      style={{...styles.categoryBtn, 
                        background: selectedCategory === cat ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#f0f0f0',
                        color: selectedCategory === cat ? 'white' : '#333'
                      }}
                    >
                      {cat === 'All' ? '🌟 All Categories' : cat}
                    </button>
                  ))}
                </div>
                <button onClick={handleStartGame} style={styles.button}>🚀 Start Game</button>
              </>
            )}
          </div>
        ) : currentQuestion ? (
          <div style={styles.card}>
            <div style={styles.timerBar}>
              <div style={{ ...styles.timerFill, width: `${(timeLeft / 15) * 100}%` }} />
            </div>
            <div style={{...styles.timerText, color: timeLeft <= 5 ? '#c62828' : '#333'}}>
              {timeLeft <= 5 ? '⚠️' : '⏱️'} {timeLeft}s
            </div>
            <div style={styles.categoryBadge}>{currentQuestion.category}</div>
            <h2>Question {questionNumber}/{totalQuestions}</h2>
            <p style={styles.questionText}>{currentQuestion.question}</p>
            <div style={styles.optionsGrid}>
              {currentQuestion.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={answerLocked}
                  style={styles.optionButton}
                >
                  {String.fromCharCode(65+idx)}. {opt}
                </button>
              ))}
            </div>
            {message && <p style={{...styles.message, 
              background: message.includes('✅') ? '#4caf5020' : '#f4433620',
              color: message.includes('✅') ? '#2e7d32' : '#c62828'
            }}>{message}</p>}
          </div>
        ) : (
          <div style={styles.card}><p>Loading game...</p></div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'Arial, sans-serif'
  },
  gameContainer: { width: '100%', maxWidth: '800px', margin: '20px' },
  card: {
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    textAlign: 'center'
  },
  title: {
    fontSize: '2.5rem',
    marginBottom: '10px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  input: {
    width: '100%',
    padding: '15px',
    fontSize: '16px',
    borderRadius: '10px',
    border: '1px solid #ddd',
    marginBottom: '15px'
  },
  button: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '12px 30px',
    fontSize: '16px',
    border: 'none',
    borderRadius: '25px',
    cursor: 'pointer',
    marginTop: '10px'
  },
  secondaryButton: {
    background: 'transparent',
    border: '1px solid #667eea',
    color: '#667eea',
    padding: '10px 20px',
    fontSize: '14px',
    borderRadius: '25px',
    cursor: 'pointer',
    marginTop: '10px',
    marginLeft: '10px'
  },
  soundButton: {
    background: 'transparent',
    border: '1px solid #ddd',
    padding: '8px 16px',
    borderRadius: '20px',
    cursor: 'pointer',
    marginTop: '15px'
  },
  smallSoundBtn: { background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '5px' },
  smallLogoutBtn: { background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '5px' },
  logoutBtn: { background: '#f44336', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px' },
  userHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #ddd' },
  authToggle: { display: 'flex', marginBottom: '20px' },
  authTab: { flex: 1, padding: '10px', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#667eea' },
  error: { color: '#f44336', marginTop: '10px' },
  header: { background: 'white', padding: '15px', borderRadius: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  scoreBadge: { background: '#667eea', color: 'white', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold' },
  questionText: { fontSize: '1.5rem', margin: '20px 0' },
  optionsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '20px' },
  optionButton: { padding: '15px', fontSize: '16px', background: '#f0f0f0', border: 'none', borderRadius: '10px', cursor: 'pointer', transition: 'transform 0.2s' },
  message: { marginTop: '20px', padding: '10px', borderRadius: '10px' },
  timerBar: { height: '10px', background: '#ddd', borderRadius: '5px', overflow: 'hidden', marginBottom: '10px' },
  timerFill: { height: '100%', background: 'linear-gradient(90deg, #4caf50, #ff9800, #f44336)', transition: 'width 1s linear' },
  timerText: { fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' },
  leaderboardRow: { display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #ddd' },
  playerList: { listStyle: 'none', padding: 0, textAlign: 'center' },
  categoryGrid: { display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', margin: '20px 0' },
  categoryBtn: { padding: '8px 16px', border: 'none', borderRadius: '25px', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' },
  categoryBadge: { display: 'inline-block', background: '#764ba2', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', marginBottom: '10px' },
  confettiOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 1000 },
  globalLeaderboard: { marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '10px', maxHeight: '200px', overflowY: 'auto' }
};

export default App;