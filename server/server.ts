import { Server } from "socket.io";
import http from "http";
import { app } from "./app.ts";
import { config } from "dotenv";
import mongoose from "mongoose";
import { Game } from "./models/Game.ts";
import { User } from "./models/User.ts";

config({ path: "./config.env" });

mongoose
  .connect(process.env.MONGO_URI!)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"], credentials: false },
});

// ── Types ─────────────────────────────────────────────────────────────────────
type Color = "red" | "blue" | "green" | "yellow";

interface TokenState {
  id: string;         // e.g. "R1"
  inHome: boolean;    // still in starting yard
  steps: number;      // steps traveled from this player's entry square (0 = on start sq)
  inHomeStretch: boolean;
  homeStretchPos: number; // 0-4 inside the coloured column; 5 = finished
  finished: boolean;
}

interface PlayerState {
  socketId: string;
  userId?: string;
  username: string;
  color: Color;
  tokens: TokenState[];
  connected: boolean;
  captures: number;
  turns: number;
  sixesRolled: number;
  rank?: number;
  coinsEarned: number;
}

interface ChatMessage {
  sender: string;
  color: Color | "system";
  text: string;
  time: string;
}

interface LogEntry {
  time: string;
  color: Color | "system";
  text: string;
  type: "roll" | "move" | "capture" | "finish" | "system";
}

interface GameRoom {
  gameId: string;
  players: PlayerState[];
  turnIndex: number;     // index into players[]
  currentRoll: number | null;
  lastRoll?: number | null;
  rollHistory: number[];
  status: "waiting" | "playing" | "finished";
  finishOrder: Color[];
  chatMessages: ChatMessage[];
  gameLog: LogEntry[];
  startedAt: Date | null;
}

// ── In-memory stores ──────────────────────────────────────────────────────────
const lobbies = new Map<string, Array<{
  socketId: string; userId?: string; username: string; color?: string;
}>>();

const games = new Map<string, GameRoom>();

// Auto-roll timers: gameId → timeout handle
const autoRollTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Selection timers: after a roll, wait for player to pick a token; gameId -> timeout
const selectionTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ── Constants ─────────────────────────────────────────────────────────────────
const COLORS: Color[] = ["red", "blue", "green", "yellow"];
const TURN_TIMEOUT_MS = 20_000;

// Main track entry squares per color (0-indexed, 0-51 outer loop)
const ENTRY: Record<Color, number> = { red: 0, blue: 13, green: 26, yellow: 39 };

// Safe squares on the outer track (absolute indices)
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Coin awards per player count and rank
const COINS: Record<number, Record<number, number>> = {
  4: { 1: 100, 2: 50, 3: 25, 4: 0 },
  3: { 1: 50, 2: 25, 3: 0 },
  2: { 1: 25, 2: 0 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function now(): string {
  return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function cap(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

function makeTokens(color: Color): TokenState[] {
  return [1, 2, 3, 4].map((n) => ({
    id: `${color[0].toUpperCase()}${n}`,
    inHome: true,
    steps: 0,
    inHomeStretch: false,
    homeStretchPos: 0,
    finished: false,
  }));
}

function absPos(color: Color, steps: number): number {
  return (ENTRY[color] + steps) % 52;
}

function canMove(t: TokenState, roll: number): boolean {
  if (t.finished) return false;
  if (t.inHome) return roll === 6;
  if (t.inHomeStretch) return t.homeStretchPos + roll <= 5;
  return true; // on main track
}

function movableTokenIds(player: PlayerState, roll: number): string[] {
  return player.tokens.filter((t) => canMove(t, roll)).map((t) => t.id);
}

function allFinished(player: PlayerState): boolean {
  return player.tokens.every((t) => t.finished);
}

function clearAutoRoll(gameId: string) {
  const t = autoRollTimers.get(gameId);
  if (t) { clearTimeout(t); autoRollTimers.delete(gameId); }
}

function clearSelectionTimer(gameId: string) {
  const t = selectionTimers.get(gameId);
  if (t) { clearTimeout(t); selectionTimers.delete(gameId); }
}

function scheduleAutoRoll(gameId: string) {
  clearAutoRoll(gameId);
  autoRollTimers.set(gameId, setTimeout(() => {
    const room = games.get(gameId);
    if (!room || room.status !== "playing" || room.currentRoll !== null) return;
    const roll = Math.floor(Math.random() * 6) + 1;
    room.currentRoll = roll;
    room.lastRoll = roll;
    room.rollHistory = [roll, ...room.rollHistory].slice(0, 5);
    const player = room.players[room.turnIndex];
    room.gameLog.push({
      time: now(), color: player.color,
      text: `${cap(player.color)} auto-rolled ${roll}.`, type: "roll",
    });
    const movable = movableTokenIds(player, roll);
    if (movable.length === 0) {
      room.gameLog.push({ time: now(), color: player.color, text: `${cap(player.color)} has no valid moves. Turn passes.`, type: "system" });
      advanceTurn(room, false);
      io.to(`game_${gameId}`).emit("gameState", room);
      scheduleAutoRoll(gameId);
    } else {
      const tokenId = movable[Math.floor(Math.random() * movable.length)];
      applyMoveAndBroadcast(gameId, room, tokenId, roll);
    }
  }, TURN_TIMEOUT_MS));
}

function advanceTurn(room: GameRoom, extraTurn: boolean) {
  room.currentRoll = null;
  if (extraTurn) return; // same player rolls again
  // skip finished players
  let next = (room.turnIndex + 1) % room.players.length;
  let safety = 0;
  while (allFinished(room.players[next]) && safety < room.players.length) {
    next = (next + 1) % room.players.length;
    safety++;
  }
  room.turnIndex = next;
}

function applyMoveAndBroadcast(gameId: string, room: GameRoom, tokenId: string, roll: number) {
  clearAutoRoll(gameId);
  clearSelectionTimer(gameId);
  const player = room.players[room.turnIndex];
  const token = player.tokens.find((t) => t.id === tokenId);
  if (!token || !canMove(token, roll)) {
    io.to(`game_${gameId}`).emit("gameState", room);
    return;
  }

  let capturedColor: Color | null = null;
  let capturedTokenId: string | null = null;

  // ── Move token ──
  if (token.inHome && roll === 6) {
    token.inHome = false;
    token.steps = 0; // on start square
  } else if (!token.inHomeStretch) {
    // on main track
    const newSteps = token.steps + roll;
    // Enter home stretch when steps exceed full loop (52 steps)
    if (newSteps >= 52) {
      token.inHomeStretch = true;
      token.homeStretchPos = newSteps - 52; // 0-based inside coloured column
      if (token.homeStretchPos >= 5) {
        token.homeStretchPos = 5;
        token.inHomeStretch = false;
        token.finished = true;
      }
    } else {
      token.steps = newSteps;
    }
  } else {
    // in home stretch
    token.homeStretchPos += roll;
    if (token.homeStretchPos >= 5) {
      token.homeStretchPos = 5;
      token.inHomeStretch = false;
      token.finished = true;
    }
  }

  // ── Capture check (only on main track, non-safe squares) ──
  if (!token.inHomeStretch && !token.finished && !token.inHome) {
    const myAbs = absPos(player.color, token.steps);
    if (!SAFE.has(myAbs)) {
      for (const other of room.players) {
        if (other.color === player.color) continue;
        for (const ot of other.tokens) {
          if (ot.inHome || ot.inHomeStretch || ot.finished) continue;
          if (absPos(other.color, ot.steps) === myAbs) {
            // Send back home
            ot.inHome = true;
            ot.steps = 0;
            capturedColor = other.color;
            capturedTokenId = ot.id;
            player.captures++;
            const capMsg = `${cap(player.color)} captured ${cap(other.color)}'s ${ot.id} — sent home!`;
            room.chatMessages.push({ sender: "System", color: "system", text: capMsg, time: now() });
            room.gameLog.push({ time: now(), color: player.color, text: capMsg, type: "capture" });
            io.to(`game_${gameId}`).emit("chatMessage", room.chatMessages[room.chatMessages.length - 1]);
          }
        }
      }
    }
  }

  // Log the move
  room.gameLog.push({
    time: now(), color: player.color,
    text: `${cap(player.color)} moved ${token.id}${token.finished ? " — reached the finish! ★" : ""}.`,
    type: token.finished ? "finish" : "move",
  });

  // Persist move into Game document (non-blocking)
  try {
    const tokenIndex = parseInt(token.id.slice(1)) - 1;
    Game.findByIdAndUpdate(gameId, {
      $push: { moves: { by: player.username, tokenIndex, value: roll, at: new Date(), capture: !!capturedColor } }
    }).catch((e) => console.error("persist move error:", e));
  } catch (e) {
    console.error("persist move prepare error:", e);
  }

  // ── Check if player finished all tokens ──
  if (allFinished(player) && !room.finishOrder.includes(player.color)) {
    room.finishOrder.push(player.color);
    player.rank = room.finishOrder.length;
    const finMsg = `${cap(player.color)} (${player.username}) finished in position ${player.rank}! 🎉`;
    room.chatMessages.push({ sender: "System", color: "system", text: finMsg, time: now() });
    room.gameLog.push({ time: now(), color: player.color, text: finMsg, type: "finish" });
    io.to(`game_${gameId}`).emit("chatMessage", room.chatMessages[room.chatMessages.length - 1]);
  }

  // Count active (non-finished) players
  const activePlayers = room.players.filter((p) => !allFinished(p));

  if (activePlayers.length <= 1) {
    // Last player gets last rank
    for (const p of room.players) {
      if (!room.finishOrder.includes(p.color)) {
        room.finishOrder.push(p.color);
        p.rank = room.finishOrder.length;
      }
    }
    endGame(gameId, room);
    return;
  }

  // Extra turn on 6 (no capture occurred)
  const extraTurn = roll === 6 && capturedColor === null;
  if (extraTurn) {
    player.sixesRolled++;
    room.gameLog.push({ time: now(), color: player.color, text: `${cap(player.color)} rolled 6 — extra turn!`, type: "system" });
  }

  player.turns++;
  advanceTurn(room, extraTurn);
  io.to(`game_${gameId}`).emit("gameState", room);
  scheduleAutoRoll(gameId);

  // Trigger AI for disconnected player
  const nextPlayer = room.players[room.turnIndex];
  if (!nextPlayer.connected) {
    triggerAI(gameId, room);
  }
}

function triggerAI(gameId: string, room: GameRoom, delay = 1500) {
  setTimeout(() => {
    const r = games.get(gameId);
    if (!r || r.status !== "playing" || r.currentRoll !== null) return;
    const player = r.players[r.turnIndex];
    if (player.connected) return; // reconnected
    const roll = Math.floor(Math.random() * 6) + 1;
    r.currentRoll = roll;
    r.rollHistory = [roll, ...r.rollHistory].slice(0, 5);
    r.gameLog.push({ time: now(), color: player.color, text: `AI (${cap(player.color)}) rolled ${roll}.`, type: "roll" });
    const movable = movableTokenIds(player, roll);
    if (movable.length === 0) {
      r.gameLog.push({ time: now(), color: player.color, text: `${cap(player.color)} has no valid moves. Turn passes.`, type: "system" });
      advanceTurn(r, false);
      io.to(`game_${gameId}`).emit("gameState", r);
      scheduleAutoRoll(gameId);
    } else {
      const tokenId = movable[Math.floor(Math.random() * movable.length)];
      applyMoveAndBroadcast(gameId, r, tokenId, roll);
    }
  }, delay);
}

async function endGame(gameId: string, room: GameRoom) {
  clearAutoRoll(gameId);
  room.status = "finished";
  const n = room.players.length;
  for (const p of room.players) {
    p.coinsEarned = COINS[n]?.[p.rank ?? n] ?? 0;
  }
  io.to(`game_${gameId}`).emit("gameOver", room);

  // Persist to MongoDB
  try {
    await Game.findByIdAndUpdate(gameId, {
      status: "finished",
      finished_at: new Date(),
      total_players: n,
      players: room.players.map((p) => ({
        user_id: p.userId && mongoose.isValidObjectId(p.userId)
          ? new mongoose.Types.ObjectId(p.userId) : undefined,
        username: p.username,
        color: p.color,
        rank: p.rank ?? n,
        coins_earned: p.coinsEarned,
      })),
    });
    for (const p of room.players) {
      if (!p.userId || !mongoose.isValidObjectId(p.userId)) continue;
      await User.findByIdAndUpdate(p.userId, {
        $inc: { coins: p.coinsEarned, total_played: 1 },
      });
    }
  } catch (err) {
    console.error("endGame persist error:", err);
  }
}

// ── Socket events ─────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("USER CONNECTED:", socket.id);

  // ── Lobby ──────────────────────────────────────────────────────────────────
  socket.on("joinLobby", async (payload: {
    room?: string; userId?: string; username: string; color?: string;
  }) => {
    try {
      const room = payload.room || "default";
      const list = lobbies.get(room) || [];

      let username = payload.username;
      if (payload.userId) {
        try {
          const u = await User.findById(payload.userId).lean();
          if (u?.username) username = u.username;
        } catch { /* ignore */ }
      }

      const filtered = list.filter(
        (p) => p.socketId !== socket.id && p.userId !== payload.userId
      );
      filtered.push({ socketId: socket.id, userId: payload.userId, username, color: payload.color });
      lobbies.set(room, filtered);
      socket.join(room);

      io.to(room).emit("lobbyUpdate", {
        players: filtered.map((p) => ({ userId: p.userId, username: p.username, color: p.color })),
      });
    } catch (err) {
      console.error("joinLobby error:", err);
    }
  });

  socket.on("leaveLobby", (payload: { room?: string }) => {
    const room = payload?.room || "default";
    const list = lobbies.get(room) || [];
    const remaining = list.filter((p) => p.socketId !== socket.id);
    lobbies.set(room, remaining);
    socket.leave(room);
    io.to(room).emit("lobbyUpdate", {
      players: remaining.map((p) => ({ username: p.username, color: p.color })),
    });
  });

  socket.on("startGame", async (payload: { room?: string }) => {
    try {
      const room = payload?.room || "default";
      const list = lobbies.get(room) || [];
      if (list.length < 2) {
        socket.emit("startError", { message: "Need at least 2 players to start" });
        return;
      }

      // Assign colors
      const assignedColors = list.map((_, i) => COLORS[i]);

      // Create DB record
      const gameDoc = await Game.create({
        total_players: list.length,
        players: list.map((p, i) => ({
          user_id: p.userId && mongoose.isValidObjectId(p.userId)
            ? new mongoose.Types.ObjectId(p.userId) : undefined,
          username: p.username,
          color: assignedColors[i],
        })),
        status: "playing",
        started_at: new Date(),
      });

      const gid = String(gameDoc._id);

      const gameRoom: GameRoom = {
        gameId: gid,
        players: list.map((p, i) => ({
          socketId: p.socketId,
          userId: p.userId,
          username: p.username,
          color: assignedColors[i],
          tokens: makeTokens(assignedColors[i]),
          connected: true,
          captures: 0,
          turns: 0,
          sixesRolled: 0,
          coinsEarned: 0,
        })),
        turnIndex: 0,
        currentRoll: null,
        rollHistory: [],
        status: "playing",
        finishOrder: [],
        chatMessages: [{ sender: "System", color: "system", text: "Game started – Good luck everyone!", time: now() }],
        gameLog: [{ time: now(), color: "system", text: "Game started.", type: "system" }],
        startedAt: new Date(),
      };

      games.set(gid, gameRoom);

      // Join each player's socket to the game room
      for (const p of list) {
        try {
          const s = io.sockets.sockets.get(p.socketId);
          if (s) s.join(`game_${gid}`);
        } catch { /* ignore */ }
      }

      io.to(room).emit("gameStarted", { gameId: gid });
      io.to(`game_${gid}`).emit("gameState", gameRoom);
      scheduleAutoRoll(gid);
    } catch (err) {
      console.error("startGame error:", err);
      socket.emit("startError", { message: "Could not start game" });
    }
  });

  // ── Game ───────────────────────────────────────────────────────────────────
  socket.on("joinGame", async (payload: { gameId: string; username?: string; userId?: string }) => {
    try {
      const gid = payload.gameId;
      if (!gid) return;
      socket.join(`game_${gid}`);

      const room = games.get(gid);
      if (room) {
        const p = room.players.find(
          (pp) => pp.username === payload.username || pp.userId === payload.userId
        );
        if (p) {
          p.socketId = socket.id;
          p.connected = true;
        }
        socket.emit("gameState", room);
      } else {
        // Load from DB on server restart
        const gameDoc = await Game.findById(gid).lean();
        if (gameDoc) {
          const restored: GameRoom = {
            gameId: gid,
            players: (gameDoc.players || []).map((pp: any, i: number) => ({
              socketId: "",
              userId: pp.user_id?.toString(),
              username: pp.username || "Player",
              color: pp.color || COLORS[i],
              tokens: makeTokens(pp.color || COLORS[i]),
              connected: false,
              captures: 0,
              turns: 0,
              sixesRolled: 0,
              coinsEarned: pp.coins_earned || 0,
            })),
            turnIndex: 0,
            currentRoll: null,
            rollHistory: [],
            status: (gameDoc.status as any) || "playing",
            finishOrder: [],
            chatMessages: [],
            gameLog: [],
            startedAt: gameDoc.started_at || null,
          };
          const p = restored.players.find(
            (pp) => pp.username === payload.username || pp.userId === payload.userId
          );
          if (p) { p.socketId = socket.id; p.connected = true; }
          games.set(gid, restored);
          socket.emit("gameState", restored);
        }
      }
    } catch (e) {
      console.error("joinGame error:", e);
    }
  });

  // Player rolls dice (server generates the value – never trust client)
  socket.on("rollDice", (payload: { gameId: string }) => {
    try {
      const room = games.get(payload.gameId);
      if (!room || room.status !== "playing") return;
      if (room.currentRoll !== null) return; // already rolled this turn

      const player = room.players[room.turnIndex];
      if (player.socketId !== socket.id) {
        socket.emit("rollError", { message: "Not your turn" });
        return;
      }

      clearAutoRoll(payload.gameId);

      const roll = Math.floor(Math.random() * 6) + 1;
      room.currentRoll = roll;
        room.lastRoll = roll;
        room.rollHistory = [roll, ...room.rollHistory].slice(0, 5);
      room.gameLog.push({ time: now(), color: player.color, text: `${cap(player.color)} rolled ${roll}.`, type: "roll" });

      const movable = movableTokenIds(player, roll);

      if (movable.length === 0) {
        room.gameLog.push({ time: now(), color: player.color, text: `${cap(player.color)} has no valid moves. Turn passes.`, type: "system" });
        advanceTurn(room, false);
        io.to(`game_${payload.gameId}`).emit("gameState", room);
        scheduleAutoRoll(payload.gameId);
        const next = room.players[room.turnIndex];
        if (!next.connected) triggerAI(payload.gameId, room);
        return;
      }

      // Emit updated state (client picks a token)
      io.to(`game_${payload.gameId}`).emit("gameState", room);

      // Clear any previous selection timer and start a fresh one.
      clearSelectionTimer(payload.gameId);
      const selT = setTimeout(() => {
        const r = games.get(payload.gameId);
        if (!r || r.status !== "playing" || r.currentRoll === null) return;
        const pl = r.players[r.turnIndex];
        const mv = movableTokenIds(pl, r.currentRoll);
        if (mv.length === 0) {
          r.gameLog.push({ time: now(), color: pl.color, text: `${cap(pl.color)} has no valid moves. Turn passes.`, type: "system" });
          advanceTurn(r, false);
          io.to(`game_${payload.gameId}`).emit("gameState", r);
          scheduleAutoRoll(payload.gameId);
          const next = r.players[r.turnIndex];
          if (!next.connected) triggerAI(payload.gameId, r);
          return;
        }
        const tokenId = mv[Math.floor(Math.random() * mv.length)];
        applyMoveAndBroadcast(payload.gameId, r, tokenId, r.currentRoll!);
      }, TURN_TIMEOUT_MS);
      selectionTimers.set(payload.gameId, selT);
    } catch (e) {
      console.error("rollDice error:", e);
      socket.emit("rollError", { message: "Could not roll" });
    }
  });

  // Player picks which token to move (only used when multiple tokens are movable)
  socket.on("moveToken", (payload: { gameId: string; tokenId: string }) => {
    try {
      const room = games.get(payload.gameId);
      if (!room || room.status !== "playing" || room.currentRoll === null) return;

      const player = room.players[room.turnIndex];
      if (player.socketId !== socket.id) return;

      applyMoveAndBroadcast(payload.gameId, room, payload.tokenId, room.currentRoll);
    } catch (e) {
      console.error("moveToken error:", e);
    }
  });

  // Chat message
  socket.on("sendChat", (payload: { gameId: string; text: string; sender: string; color: Color | "system" }) => {
    const room = games.get(payload.gameId);
    if (!room) return;
    const msg: ChatMessage = { sender: payload.sender, color: payload.color, text: payload.text, time: now() };
    room.chatMessages.push(msg);
    io.to(`game_${payload.gameId}`).emit("chatMessage", msg);
  });

  // Leave game
  socket.on("leaveGame", (payload: { gameId: string }) => {
    const room = games.get(payload.gameId);
    if (room) {
      const p = room.players.find((pp) => pp.socketId === socket.id);
      if (p) {
        p.connected = false;
        if (room.status === "playing" && room.players[room.turnIndex].socketId === socket.id) {
          triggerAI(payload.gameId, room, 500);
        }
        io.to(`game_${payload.gameId}`).emit("gameState", room);

        // If only one connected player remains, declare them the winner immediately
        const connectedPlayers = room.players.filter(pl => pl.connected);
        if (connectedPlayers.length === 1 && room.status === "playing") {
          const winner = connectedPlayers[0];
          room.finishOrder = [winner.color, ...room.players.filter(p2 => p2.color !== winner.color).map(p2 => p2.color)];
          room.players.forEach((pp) => { pp.rank = room.finishOrder.indexOf(pp.color) + 1; });
          endGame(payload.gameId, room);
          return;
        }
      }
    }
    socket.leave(`game_${payload.gameId}`);
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log("USER DISCONNECTED:", socket.id);

    // Remove from lobbies
    for (const [room, list] of lobbies.entries()) {
      const remaining = list.filter((p) => p.socketId !== socket.id);
      if (remaining.length !== list.length) {
        lobbies.set(room, remaining);
        io.to(room).emit("lobbyUpdate", {
          players: remaining.map((p) => ({ username: p.username, color: p.color })),
        });
      }
    }

    // Mark disconnected in active games + hand to AI
    for (const [gid, room] of games.entries()) {
      const p = room.players.find((pp) => pp.socketId === socket.id);
      if (p) {
        p.connected = false;
        if (room.status === "playing" && room.players[room.turnIndex].socketId === socket.id) {
          triggerAI(gid, room, 2000);
        }
        io.to(`game_${gid}`).emit("gameState", room);

        // If only one connected player remains, declare them the winner immediately
        const connectedPlayers = room.players.filter(pl => pl.connected);
        if (connectedPlayers.length === 1 && room.status === "playing") {
          const winner = connectedPlayers[0];
          room.finishOrder = [winner.color, ...room.players.filter(p2 => p2.color !== winner.color).map(p2 => p2.color)];
          room.players.forEach((pp) => { pp.rank = room.finishOrder.indexOf(pp.color) + 1; });
          endGame(gid, room);
        }
      }
    }
  });
});

const PORT = Number(process.env.PORT ?? 8000);

function shutdown(signal: string) {
  console.log(`Received ${signal}. Closing server...`);

  try {
    io.close();
  } catch {}

  try {
    server.close(() => {
      mongoose.connection.close(false).finally(() => {
        process.exit(0);
      });
    });
  } catch {
    process.exit(0);
  }
}

server.on("error", (err: any) => {
  if (err?.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other process using 8000, then run again.`);
    process.exit(1);
  }
  console.error("Server error:", err);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGUSR2", () => shutdown("SIGUSR2"));