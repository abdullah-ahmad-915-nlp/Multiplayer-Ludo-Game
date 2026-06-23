import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import "../assets/history.css"
import "../assets/styles.css"

type HistoryEntry = {
  gameId: string;
  finishedAt: string | Date | null;
  totalPlayers: number;
  players: string[];
  rank: number | null;
  coinsEarned: number;
};

export default function History() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const token = document.cookie.match(/(?:^|; )token=([^;]+)/)?.[1];
    const userId = token && token.startsWith("token_") ? token.replace("token_", "") : null;
    if (!userId) {
      setError("Not logged in");
      setLoading(false);
      return;
    }

    fetch(`http://localhost:8000/api/users/${userId}/history`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load history");
        return res.json();
      })
      .then((json) => {
        setHistory(json.history || []);
      })
      .catch((err) => setError(err.message || "Error"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <nav className="navbar">
        <div className="navbar-left">
          <Link to="/home" className="navbar-title">🎲 LUDO</Link>
        </div>
        <div className="navbar-right">
          <div className="coin-display">
            <span className="coin-icon">💰</span>
            <span className="coin-amount">-- Coins</span>
          </div>
        </div>
      </nav>

      <div className="history-container">
        <div className="history-header">
          <div className="header-top">
            <h2>Game History</h2>
            <Link to="/home" className="back-link">← Back to Home</Link>
          </div>
          <p className="header-subtitle">Review all your past matches</p>
        </div>

        <div className="history-list">
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center' }}>Loading…</div>
          ) : error ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'red' }}>{error}</div>
          ) : history.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center' }}>No game history found.</div>
          ) : (
            history.map((h) => (
              <div className="history-item" key={String(h.gameId)}>
                <div className="game-header">
                  <span className="game-id">Game #{String(h.gameId).slice(-6)}</span>
                  <span className="game-date">{h.finishedAt ? new Date(h.finishedAt).toLocaleString() : 'N/A'}</span>
                </div>
                <div className="game-details">
                  <div className="detail-row">
                    <span className="label">Players:</span>
                    <span className="value">{h.players.join(', ')}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Finish Position:</span>
                    <span className="value">{h.rank ? (h.rank === 1 ? '1st Place 🥇' : h.rank === 2 ? '2nd Place 🥈' : h.rank === 3 ? '3rd Place 🥉' : `${h.rank}th Place`) : '—'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Coins Earned:</span>
                    <span className="coins">{h.coinsEarned >= 0 ? `+${h.coinsEarned}` : String(h.coinsEarned)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
