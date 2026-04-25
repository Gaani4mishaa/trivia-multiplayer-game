# 🎮 Trivia Masters - Multiplayer Trivia Game

## Live Demo: [Click to Play](https://client-ecru-two-47.vercel.app)

A real-time multiplayer trivia game where players compete to answer questions faster than their friends. Built with full-stack JavaScript.

## ✨ Features

- 🔐 **User Authentication** - Register/Login with JWT tokens
- 👥 **Real-time Multiplayer** - Play with friends using Socket.io
- ⏱️ **Timer System** - 15 seconds per question with speed bonus
- 🏆 **Leaderboards** - Live game scores + all-time global rankings
- 🔊 **Sound Effects** - Audio feedback for correct/wrong answers
- 🎉 **Victory Confetti** - Celebration animation when you win
- 📚 **50+ Questions** - Across 5 categories: General, Science, History, Sports, Entertainment
- 📱 **Mobile Responsive** - Works on phones, tablets, and desktops

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite |
| Backend | Node.js + Express + Socket.io |
| Database | SQLite (sql.js) |
| Authentication | JWT + bcrypt |
| Styling | CSS-in-JS |
| Deployment | Vercel (frontend) + Render (backend) |

## 🚀 How to Play

1. Register an account
2. Login with your email
3. Enter a game name
4. Click "Join Game"
5. Wait for other players
6. Host clicks "Start Game"
7. Answer questions before time runs out!

## 📸 Screenshots

*Add screenshots of your game here*

## 🏃‍♂️ Run Locally

### Prerequisites
- Node.js (v18+)
- npm

### Backend Setup
```bash
cd server
npm install
node server.js