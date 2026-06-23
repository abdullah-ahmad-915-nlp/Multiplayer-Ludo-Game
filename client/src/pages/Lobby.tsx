import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import getSocket from "../lib/socket";
import "../assets/lobby.css";
import "../assets/styles.css";

export default function Lobby() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<{ username: string; color?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSocket();

    let username = localStorage.getItem("username");
    if (!username) {
      username = `Player_${Math.floor(Math.random() * 1000)}`;
      localStorage.setItem("username", username);
    }
    const userId = localStorage.getItem("userId") ?? undefined;

    s.emit("joinLobby", { room: "default", userId, username, color: undefined });

    const onLobbyUpdate = (data: any) => {
      setPlayers(data.players || []);
    };

    const onStartError = (data: any) => {
      setError(data.message || "Could not start");
    };

    const onGameStarted = (data: any) => {
      navigate(`/newgame/${data.gameId}`);
    };

    s.on("lobbyUpdate", onLobbyUpdate);
    s.on("startError", onStartError);
    s.on("gameStarted", onGameStarted);

    return () => {
      s.off("lobbyUpdate", onLobbyUpdate);
      s.off("startError", onStartError);
      s.off("gameStarted", onGameStarted);
      s.emit("leaveLobby", { room: "default" });
    };
  }, [navigate]);

  function handleStart() {
    const s = getSocket();
    setError(null);
    s.emit("startGame", { room: "default" });
  }

  return (
    <div className="page">
      <div className="lobby-container">
        <div className="lobby-header">
          <h1 className="lobby-title">🎲 LUDO</h1>
          <p className="lobby-subtitle">Classic Board Game Experience</p>
        </div>

        <div className="lobby-card">
          <h2>Game Lobby</h2>

          <div className="players-grid">
            {players.map((p, idx) => (
              <div key={idx} className={`player-slot ${p.username ? "filled" : "empty"}`}>
                <div className="player-slot-label">Player {idx + 1}</div>
                <div className="player-slot-name">{p.username || "Waiting..."}</div>
                <div className={`player-slot-color ${p.color || "none"}`}></div>
              </div>
            ))}

            {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="player-slot empty">
                <div className="player-slot-label">Player {players.length + i + 1}</div>
                <div className="player-slot-name">Waiting...</div>
                <div className="player-slot-color none"></div>
              </div>
            ))}
          </div>

          <button
            className="start-button"
            id="start-btn"
            onClick={handleStart}
            disabled={players.length < 2}
          >
            Start Game ({players.length}/4 Players)
          </button>

          {error && <div style={{ color: "red", marginTop: 12 }}>{error}</div>}

          <div className="lobby-footer">
            <button className="back-button" onClick={() => navigate(-1)}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}