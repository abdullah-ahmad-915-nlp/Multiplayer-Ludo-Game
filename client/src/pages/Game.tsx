import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Socket } from "socket.io-client";
import getSocket from "../lib/socket";
import "../assets/game.css";
import "../assets/styles.css";

// ── Types (must mirror server) ──────────────────────────────────────────────
type Color = "red" | "blue" | "green" | "yellow";

interface TokenState {
  id: string;
  inHome: boolean;
  steps: number;
  inHomeStretch: boolean;
  homeStretchPos: number;
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
  type: string;
}

interface GameRoom {
  gameId: string;
  players: PlayerState[];
  turnIndex: number;
  currentRoll: number | null;
  lastRoll?: number | null;
  rollHistory: number[];
  status: string;
  finishOrder: Color[];
  chatMessages: ChatMessage[];
  gameLog: LogEntry[];
}

// ── Board geometry constants ─────────────────────────────────────────────────
const ENTRY: Record<Color, number> = { red: 0, blue: 13, green: 26, yellow: 39 };
const SAFE_ABS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const TRACK_CELLS: { section: string; row: number; col: number }[] = [
  { section: "left", row: 3, col: 1 },
  { section: "left", row: 1, col: 1 },
  { section: "left", row: 1, col: 2 },
  { section: "left", row: 1, col: 3 },
  { section: "left", row: 1, col: 4 },
  { section: "left", row: 1, col: 5 },
  { section: "left", row: 1, col: 6 },
  { section: "top", row: 6, col: 1 },
  { section: "top", row: 5, col: 1 },
  { section: "top", row: 4, col: 1 },
  { section: "top", row: 3, col: 1 },
  { section: "top", row: 2, col: 1 },
  { section: "top", row: 1, col: 1 },
  { section: "top", row: 2, col: 3 },
  { section: "top", row: 1, col: 3 },
  { section: "top", row: 2, col: 3 },
  { section: "top", row: 3, col: 3 },
  { section: "top", row: 4, col: 3 },
  { section: "top", row: 5, col: 3 },
  { section: "top", row: 6, col: 3 },
  { section: "right", row: 1, col: 1 },
  { section: "right", row: 1, col: 2 },
  { section: "right", row: 1, col: 3 },
  { section: "right", row: 1, col: 4 },
  { section: "right", row: 1, col: 5 },
  { section: "right", row: 1, col: 6 },
  { section: "right", row: 3, col: 6 },
  { section: "right", row: 3, col: 5 },
  { section: "right", row: 3, col: 4 },
  { section: "right", row: 3, col: 3 },
  { section: "right", row: 3, col: 2 },
  { section: "right", row: 3, col: 1 },
  { section: "bot", row: 1, col: 3 },
  { section: "bot", row: 2, col: 3 },
  { section: "bot", row: 3, col: 3 },
  { section: "bot", row: 4, col: 3 },
  { section: "bot", row: 5, col: 3 },
  { section: "bot", row: 5, col: 1 },
  { section: "bot", row: 6, col: 1 },
  { section: "bot", row: 6, col: 2 },
  { section: "bot", row: 6, col: 3 },
  { section: "bot", row: 5, col: 1 },
  { section: "bot", row: 4, col: 1 },
  { section: "left", row: 3, col: 2 },
  { section: "left", row: 3, col: 3 },
  { section: "left", row: 3, col: 4 },
  { section: "left", row: 3, col: 5 },
  { section: "left", row: 3, col: 6 },
  { section: "left", row: 2, col: 6 },
];

function getAbsTrackPos(color: Color, steps: number): number {
  return (ENTRY[color] + steps) % 52;
}

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const [gameState, setGameState] = useState<GameRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [victoryData, setVictoryData] = useState<GameRoom | null>(null);
  const [timer, setTimer] = useState(20);

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const myUsername = localStorage.getItem("username") ?? undefined;
  const myUserId = localStorage.getItem("userId") ?? undefined;

  useEffect(() => {
    if (!gameId) {
      navigate(-1);
      return;
    }

    const s = getSocket();
    socketRef.current = s;

    const onConnect = () => {
      let username = myUsername;
      if (!username) {
        username = `Player_${Math.floor(Math.random() * 1000)}`;
        localStorage.setItem("username", username);
      }
      s.emit("joinGame", { gameId, username, userId: myUserId });
    };

    const onGameState = (state: GameRoom) => {
      setGameState(state);
      setChatMessages(state.chatMessages ?? []);
      setTimer(20);
    };

    const onChatMessage = (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
    };

    const onGameOver = (state: GameRoom) => {
      setGameState(state);
      setVictoryData(state);
      if (timerRef.current) clearInterval(timerRef.current);

      const me = state.players.find(
        (p) => p.userId === myUserId || p.username === myUsername
      );
      if (me) {
        const current = parseInt(localStorage.getItem("coins") ?? "0", 10);
        localStorage.setItem("coins", String(current + me.coinsEarned));
      }
    };

    if (s.connected) {
      onConnect();
    } else {
      s.on("connect", onConnect);
    }

    s.on("gameState", onGameState);
    s.on("chatMessage", onChatMessage);
    s.on("gameOver", onGameOver);

    return () => {
      s.off("connect", onConnect);
      s.off("gameState", onGameState);
      s.off("chatMessage", onChatMessage);
      s.off("gameOver", onGameOver);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameId, navigate, myUsername, myUserId]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!gameState || gameState.status !== "playing") return;

    setTimer(20);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState?.turnIndex]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const myPlayer = gameState?.players.find(
    (p) => p.userId === myUserId || p.username === myUsername
  );
  const activePlayer = gameState ? gameState.players[gameState.turnIndex] : null;
  const isMyTurn = !!activePlayer && (
    activePlayer.userId === myUserId ||
    activePlayer.username === myUsername
  );

  function movableTokenIds(): string[] {
    if (!isMyTurn || !myPlayer || gameState?.currentRoll === null) return [];
    const roll = gameState!.currentRoll!;
    return myPlayer.tokens
      .filter((t) => {
        if (t.finished) return false;
        if (t.inHome) return roll === 6;
        if (t.inHomeStretch) return t.homeStretchPos + roll <= 5;
        return true;
      })
      .map((t) => t.id);
  }

  function handleRoll() {
    socketRef.current?.emit("rollDice", { gameId });
  }

  function handleTokenClick(tokenId: string) {
    if (!isMyTurn || gameState?.currentRoll === null) return;
    if (!movableTokenIds().includes(tokenId)) return;
    socketRef.current?.emit("moveToken", { gameId, tokenId });
  }

  function handleSendChat() {
    if (!chatInput.trim() || !gameId) return;
    socketRef.current?.emit("sendChat", {
      gameId,
      text: chatInput.trim(),
      sender: myUsername ?? "Player",
      color: myPlayer?.color ?? "system",
    });
    setChatInput("");
  }

  function handleLeave() {
    socketRef.current?.emit("leaveGame", { gameId });
    navigate("/home");
  }

  function handleQuickReact(emoji: string) {
    socketRef.current?.emit("sendChat", {
      gameId,
      text: emoji,
      sender: myUsername ?? "Player",
      color: myPlayer?.color ?? "system",
    });
  }

  const movable = new Set(movableTokenIds());

  function renderToken(t: TokenState, playerColor: Color) {
    const isMov = movable.has(t.id);
    const colorClass = playerColor === "yellow" ? "token--yel" : `token--${playerColor}`;
    return (
      <div
        key={t.id}
        className={`token ${colorClass}`}
        style={
          isMov
            ? { boxShadow: "0 0 0 3px #f9a825, 0 2px 8px rgba(0,0,0,.4)", cursor: "pointer" }
            : { cursor: "default" }
        }
        onClick={() => isMov && handleTokenClick(t.id)}
        title={`${t.id}${isMov ? " – Click to move" : ""}`}
      >
        {t.id}
        <span className="token-tip">{t.id}</span>
      </div>
    );
  }

  type CellKey = string;
  const cellTokens: Map<CellKey, React.ReactNode[]> = new Map();
  const homeTokens: Map<Color, TokenState[]> = new Map();
  const homeStretchTokens: Map<Color, Map<number, TokenState[]>> = new Map();

  if (gameState) {
    for (const player of gameState.players) {
      const inHome: TokenState[] = [];
      const inStretch: Map<number, TokenState[]> = new Map();

      for (const token of player.tokens) {
        if (token.finished) continue;

        if (token.inHome) {
          inHome.push(token);
        } else if (token.inHomeStretch) {
          const pos = token.homeStretchPos;
          if (!inStretch.has(pos)) inStretch.set(pos, []);
          inStretch.get(pos)!.push(token);
        } else {
          const abs = getAbsTrackPos(player.color, token.steps);
          const cell = TRACK_CELLS[abs];
          if (cell) {
            const key: CellKey = `${cell.section}-${cell.row}-${cell.col}`;
            if (!cellTokens.has(key)) cellTokens.set(key, []);
            cellTokens.get(key)!.push(renderToken(token, player.color));
          }
        }
      }

      homeTokens.set(player.color, inHome);
      homeStretchTokens.set(player.color, inStretch);
    }
  }

  function getTokensForCell(section: string, row: number, col: number): React.ReactNode[] {
    return cellTokens.get(`${section}-${row}-${col}`) ?? [];
  }

  function getStretchTokens(color: Color, pos: number): React.ReactNode[] {
    const map = homeStretchTokens.get(color);
    if (!map) return [];
    return (map.get(pos) ?? []).map((t) => renderToken(t, color));
  }

  function getHomeYardTokens(color: Color): React.ReactNode[] {
    return (homeTokens.get(color) ?? []).map((t) => renderToken(t, color));
  }

  const timerStr = `${String(Math.floor(timer / 60)).padStart(2, "0")}:${String(timer % 60).padStart(2, "0")}`;
  const roomLabel = gameId ? `#LUDO-${gameId.slice(-4).toUpperCase()}` : "#----";

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-info">
          <div><span>Room: </span><strong>{roomLabel}</strong></div>
          <div><span>Mode: </span><strong>Classic ({gameState?.players.length ?? "?"} players)</strong></div>
        </div>
        <div className="timer">{timerStr}</div>
        <div className="flex-row gap-8px">
          <button className="btn btn-danger" onClick={handleLeave}>✕ Leave Game</button>
        </div>
      </div>

      <div className="layout">
        <aside>
          <div className="panel">
            <div className="panel-hd">
              {isMyTurn ? "Your Turn – Roll Dice" : `${activePlayer?.username ?? "…"}'s Turn`}
            </div>
            <div className="panel-bd">
              <div className="die-number">
                {gameState?.currentRoll ?? gameState?.lastRoll ?? "–"}
              </div>
              <button
                className="roll-btn"
                onClick={handleRoll}
                disabled={!isMyTurn || gameState?.currentRoll !== null || gameState?.status !== "playing"}
              >
                Roll!
              </button>
              <div className="roll-hist">
                Recent:{" "}
                {(gameState?.rollHistory ?? []).map((r, i) => (
                  <span key={i} className="rp">{r}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-hd">Players</div>
            <div className="panel-bd">
              {(gameState?.players ?? []).map((p, idx) => {
                const onBoard = p.tokens.filter((t) => !t.inHome && !t.finished && !t.inHomeStretch).length;
                const inHomeCount = p.tokens.filter((t) => t.inHome).length;
                const finCount = p.tokens.filter((t) => t.finished).length;
                const pct = Math.round((finCount / 4) * 100);
                const active = gameState?.turnIndex === idx;
                return (
                  <div key={p.color} className={`player-card${active ? " active" : ""}${!p.connected ? " out" : ""}`}>
                    {active && <span className="active-badge">Your Turn</span>}
                    <div className="p-name">
                      <div className={`p-dot dot-${p.color}`}></div>
                      {p.username}{p.username === myUsername ? " (You)" : ""}
                      {!p.connected ? " 🤖" : ""}
                    </div>
                    <div className="p-stats">On board: {onBoard} &nbsp;|&nbsp; Home: {inHomeCount} &nbsp;|&nbsp; Fin: {finCount}</div>
                    <div className="prog-wrap">
                      <div
                        className={`prog-fill bg-${p.color}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="board-area">
          <div className="ludo-board">
            <div className="board-row board-row--top">
              <div className="home home--red">
                <div className="yard">
                  {[0, 1, 2, 3].map((slot) => {
                    const homeList = getHomeYardTokens("red");
                    return (
                      <div key={slot} className="token-slot">
                        {homeList[slot] ?? null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="track-col track-col--top">
                <div className="sq">{getTokensForCell("top", 1, 1)}</div>
                <div className="sq sq--home-blue">{getStretchTokens("blue", 4)}</div>
                <div className="sq">{getTokensForCell("top", 1, 3)}</div>

                <div className="sq">{getTokensForCell("top", 2, 1)}</div>
                <div className="sq sq--home-blue">{getStretchTokens("blue", 3)}</div>
                <div className="sq sq--safe sq--start-blue">{getTokensForCell("top", 2, 3)}</div>

                <div className="sq sq--safe">{getTokensForCell("top", 3, 1)}</div>
                <div className="sq sq--home-blue">{getStretchTokens("blue", 2)}</div>
                <div className="sq">{getTokensForCell("top", 3, 3)}</div>

                <div className="sq">{getTokensForCell("top", 4, 1)}</div>
                <div className="sq sq--home-blue">{getStretchTokens("blue", 1)}</div>
                <div className="sq">{getTokensForCell("top", 4, 3)}</div>

                <div className="sq">{getTokensForCell("top", 5, 1)}</div>
                <div className="sq sq--home-blue">{getStretchTokens("blue", 0)}</div>
                <div className="sq">{getTokensForCell("top", 5, 3)}</div>

                <div className="sq">{getTokensForCell("top", 6, 1)}</div>
                <div className="sq sq--home-blue"></div>
                <div className="sq">{getTokensForCell("top", 6, 3)}</div>
              </div>

              <div className="home home--blue">
                <div className="yard">
                  {[0, 1, 2, 3].map((slot) => {
                    const homeList = getHomeYardTokens("blue");
                    return (
                      <div key={slot} className="token-slot">
                        {homeList[slot] ?? null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="board-row board-row--mid">
              <div className="track-col track-col--left">
                <div className="sq sq--safe">{getTokensForCell("left", 1, 1)}</div>
                <div className="sq sq--start-red">{getTokensForCell("left", 1, 2)}</div>
                <div className="sq">{getTokensForCell("left", 1, 3)}</div>
                <div className="sq">{getTokensForCell("left", 1, 4)}</div>
                <div className="sq">{getTokensForCell("left", 1, 5)}</div>
                <div className="sq">{getTokensForCell("left", 1, 6)}</div>

                <div className="sq">{getTokensForCell("left", 2, 1)}</div>
                <div className="sq sq--home-red">{getStretchTokens("red", 0)}</div>
                <div className="sq sq--home-red">{getStretchTokens("red", 1)}</div>
                <div className="sq sq--home-red">{getStretchTokens("red", 2)}</div>
                <div className="sq sq--home-red">{getStretchTokens("red", 3)}</div>
                <div className="sq sq--home-red">{getStretchTokens("red", 4)}</div>

                <div className="sq sq--start-red">{getTokensForCell("left", 3, 1)}</div>
                <div className="sq">{getTokensForCell("left", 3, 2)}</div>
                <div className="sq sq--safe">{getTokensForCell("left", 3, 3)}</div>
                <div className="sq">{getTokensForCell("left", 3, 4)}</div>
                <div className="sq">{getTokensForCell("left", 3, 5)}</div>
                <div className="sq">{getTokensForCell("left", 3, 6)}</div>
              </div>

              <div className="centre">
                <div className="tri tri--top"></div>
                <div className="tri tri--right"></div>
                <div className="tri tri--bot"></div>
                <div className="tri tri--left"></div>
                <span className="centre-star">★</span>
              </div>

              <div className="track-col track-col--right">
                <div className="sq">{getTokensForCell("right", 1, 1)}</div>
                <div className="sq">{getTokensForCell("right", 1, 2)}</div>
                <div className="sq">{getTokensForCell("right", 1, 3)}</div>
                <div className="sq sq--safe">{getTokensForCell("right", 1, 4)}</div>
                <div className="sq sq--start-yellow">{getTokensForCell("right", 1, 5)}</div>
                <div className="sq">{getTokensForCell("right", 1, 6)}</div>

                <div className="sq sq--home-yellow">{getStretchTokens("yellow", 4)}</div>
                <div className="sq sq--home-yellow">{getStretchTokens("yellow", 3)}</div>
                <div className="sq sq--home-yellow">{getStretchTokens("yellow", 2)}</div>
                <div className="sq sq--home-yellow">{getStretchTokens("yellow", 1)}</div>
                <div className="sq sq--home-yellow">{getStretchTokens("yellow", 0)}</div>
                <div className="sq">{getTokensForCell("right", 2, 6)}</div>

                <div className="sq">{getTokensForCell("right", 3, 1)}</div>
                <div className="sq">{getTokensForCell("right", 3, 2)}</div>
                <div className="sq">{getTokensForCell("right", 3, 3)}</div>
                <div className="sq">{getTokensForCell("right", 3, 4)}</div>
                <div className="sq sq--start-green">{getTokensForCell("right", 3, 5)}</div>
                <div className="sq">{getTokensForCell("right", 3, 6)}</div>
              </div>
            </div>

            <div className="board-row board-row--bot">
              <div className="home home--green">
                <div className="yard">
                  {[0, 1, 2, 3].map((slot) => {
                    const homeList = getHomeYardTokens("green");
                    return (
                      <div key={slot} className="token-slot">
                        {homeList[slot] ?? null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="track-col track-col--bot">
                <div className="sq">{getTokensForCell("bot", 1, 1)}</div>
                <div className="sq sq--home-green"></div>
                <div className="sq sq--start-green">{getTokensForCell("bot", 1, 3)}</div>

                <div className="sq">{getTokensForCell("bot", 2, 1)}</div>
                <div className="sq sq--home-green">{getStretchTokens("green", 4)}</div>
                <div className="sq">{getTokensForCell("bot", 2, 3)}</div>

                <div className="sq">{getTokensForCell("bot", 3, 1)}</div>
                <div className="sq sq--home-green">{getStretchTokens("green", 3)}</div>
                <div className="sq">{getTokensForCell("bot", 3, 3)}</div>

                <div className="sq">{getTokensForCell("bot", 4, 1)}</div>
                <div className="sq sq--home-green">{getStretchTokens("green", 2)}</div>
                <div className="sq sq--safe">{getTokensForCell("bot", 4, 3)}</div>

                <div className="sq sq--start-green">{getTokensForCell("bot", 5, 1)}</div>
                <div className="sq sq--home-green">{getStretchTokens("green", 1)}</div>
                <div className="sq">{getTokensForCell("bot", 5, 3)}</div>

                <div className="sq">{getTokensForCell("bot", 6, 1)}</div>
                <div className="sq sq--home-green">{getStretchTokens("green", 0)}</div>
                <div className="sq">{getTokensForCell("bot", 6, 3)}</div>
              </div>

              <div className="home home--yellow">
                <div className="yard">
                  {[0, 1, 2, 3].map((slot) => {
                    const homeList = getHomeYardTokens("yellow");
                    return (
                      <div key={slot} className="token-slot">
                        {homeList[slot] ?? null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside>
          <div className="panel">
            <div className="panel-hd">Live Chat</div>
            <div className="chat-window">
              <div className="chat-messages">
                {chatMessages.map((msg, i) => {
                  const isSystem = msg.color === "system";
                  const isMine = msg.sender === myUsername;
                  return (
                    <div key={i} className={`chat-msg${isSystem ? " sys" : isMine ? " mine" : ""}`}>
                      {!isSystem && (
                        <div className={`msg-meta${isMine ? " flex-end-justify" : ""}`}>
                          {!isMine && <span className={`msg-sender msg-sender-${msg.color}`}>{msg.sender}</span>}
                          <span className="msg-time">{msg.time}</span>
                          {isMine && <span className={`msg-sender msg-sender-${msg.color}`}>You</span>}
                        </div>
                      )}
                      <div className="msg-bubble">{msg.text}</div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <div className="quick-react">
                {["👏", "😂", "😱", "👍", "😬", "🎉"].map((e) => (
                  <button key={e} className="qr-btn" onClick={() => handleQuickReact(e)}>{e}</button>
                ))}
              </div>
              <div className="chat-input-row">
                <input
                  type="text"
                  placeholder="Type a message…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                />
                <button onClick={handleSendChat}>Send</button>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-hd">Game Log</div>
            <div className="game-log">
              {(gameState?.gameLog ?? []).slice(-20).map((entry, i) => (
                <div
                  key={i}
                  className={`log-entry${entry.type === "capture" ? " capture" : entry.type === "finish" ? " finish" : ""}`}
                >
                  <span className="log-time">{entry.time}</span>
                  {entry.color !== "system" && (
                    <div className={`log-dot log-dot-${entry.color}`}></div>
                  )}
                  <span className="log-text">{entry.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-hd">Scores &amp; Stats</div>
            <div className="panel-bd">
              {myPlayer && (
                <div className="score-grid">
                  <div className="score-cell">
                    <div className="sc-label">Tokens Finished</div>
                    <div className="sc-value sc-value-green">
                      {myPlayer.tokens.filter((t) => t.finished).length}
                    </div>
                  </div>
                  <div className="score-cell">
                    <div className="sc-label">Captures</div>
                    <div className="sc-value" style={{ color: "#c62828" }}>{myPlayer.captures}</div>
                  </div>
                  <div className="score-cell">
                    <div className="sc-label">Turns Taken</div>
                    <div className="sc-value">{myPlayer.turns}</div>
                  </div>
                  <div className="score-cell">
                    <div className="sc-label">6s Rolled</div>
                    <div className="sc-value sc-value-blue">{myPlayer.sixesRolled}</div>
                  </div>
                </div>
              )}
              <div className="standings-wrap">
                <div className="standings-title">Standings</div>
                {(gameState?.players ?? []).map((p) => {
                  const finCount = p.tokens.filter((t) => t.finished).length;
                  return (
                    <div key={p.color} className="standing-row">
                      <span className="s-rank">{p.rank ? `${p.rank}.` : "–"}</span>
                      <div className={`p-dot dot-${p.color}`}></div>
                      <span className="flex-1">
                        {p.username}
                        {p.username === myUsername ? " (You)" : ""}
                      </span>
                      <strong className={`standing-strong-${p.color}`}>{finCount} fin</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {victoryData && (
        <div className="victory-overlay" style={{ display: "flex" }}>
          <div className="victory-card">
            <div className="vc-trophy">🏆</div>
            <h2>Game Over!</h2>
            <div className={`vc-winner color-${victoryData.finishOrder[0] ?? "red"}`}>
              {victoryData.players.find((p) => p.color === victoryData.finishOrder[0])?.username ?? "?"} Wins!
            </div>
            <div className="vc-stats">
              {victoryData.players
                .filter((p) => p.rank != null)
                .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
                .map((p) => (
                  <div key={p.color}>
                    #{p.rank} {p.username} — +{p.coinsEarned} coins
                  </div>
                ))}
            </div>
            <div className="vc-actions">
              <button className="btn btn-success" onClick={() => { setVictoryData(null); navigate("/newgame/lobby"); }}>
                Play Again
              </button>
              <button className="btn btn-muted" onClick={() => { setVictoryData(null); navigate("/home"); }}>
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}