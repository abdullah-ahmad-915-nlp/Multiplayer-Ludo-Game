# 🎲 Multiplayer Ludo Game

A real-time, browser-based multiplayer Ludo game built as a full-stack TypeScript MERN-style web application. Up to four players can join a shared lobby, compete on a classic 15×15 board, capture each other's tokens, and chat live. These are all synchronized instantly via Socket.IO with zero page reloads during gameplay.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Setup](#%EF%B8%8F-setup)

---

## 🌐 Overview

This project implements the classic board game Ludo as a real-time multiplayer web application using modern TypeScript stack.
- Frontend (React + Vite) provides a UI that is responsive.
- Backend (Node.js + Express) manages game state using MongoDB and exposes REST APIs.
- Socket.IO ensures that communication between players is real-time.

---

## ✨ Features

### 🔐 Authentication
- User signup and login
- Custom token authentication

### 📊 Data Persistence
- Storage of game outcomes in MongoDB
- Integrated leaderboard functionality
- Tracking player statistics and gameplay history

### ⚡ Real-Time Gameplay
- Real-time multiplayer experience
- Instant communication using Socket.IO
- Synchronized game events, timers, chat and player actions across all clients

### 🎮 Game Session Management
- Ability to create and enter game rooms
- Server-side game logic validation and state management

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite) + TypeScript |
| Real-time | Socket.IO |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |

---

## ⚙️ Setup

**Note:** It is best to setup with more than one terminals opened simultaneously. 

### Backend

Open the first terminal and run the following commands

```
cd server
npm install
```

In the server directory, create a new file named `config.env` with following contents

```
PORT=8000
MONGO_URI=your_mongodb_connection_string
NODE_ENV=development
```

Replace `your_mongodb_connection_string` with your actual connection string and connect to MongoDB

Run the server using the following command in the first terminal

```
npm run dev
```

### Frontend

Open the second terminal and run the following commands
```
cd client
npm install
npm run dev
```
