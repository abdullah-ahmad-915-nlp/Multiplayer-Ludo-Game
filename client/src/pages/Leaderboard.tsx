import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "../assets/leaderboard.css"
import "../assets/styles.css"

type Entry = { username: string; coins: number; total_played: number };

export default function Leaderboard() {
  const [data, setData] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("http://localhost:8000/api/users/leaderboard")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load leaderboard");
        return res.json();
      })
      .then((json) => {
        setData(json.leaderboard || []);
      })
      .catch((err) => setError(err.message || "Error"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    return data.filter((d) => d.username.toLowerCase().includes(query.toLowerCase()));
  }, [data, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const currentUser = (() => {
    const u = document.cookie.match(/(?:^|; )username=([^;]+)/)?.[1];
    return u ? decodeURIComponent(u) : null;
  })();

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

      <div className="leaderboard-container">
        <div className="leaderboard-header">
          <div className="header-top">
            <h2>Global Leaderboard</h2>
            <Link to="/home" className="back-link">← Back to Home</Link>
          </div>

          <div className="search-section">
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              type="text"
              id="search-input"
              className="search-input"
              placeholder="Search by username..."
            />
          </div>
        </div>

        <div className="leaderboard-wrapper">
          {loading ? (
            <div style={{ padding: 20, textAlign: "center" }}>Loading…</div>
          ) : error ? (
            <div style={{ padding: 20, textAlign: "center", color: "red" }}>{error}</div>
          ) : (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="rank-col">Rank</th>
                  <th className="name-col">Username</th>
                  <th className="games-col">Games Played</th>
                  <th className="coins-col">Coins</th>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: 20 }}>No results</td>
                  </tr>
                )}
                {pageData.map((row, idx) => {
                  const globalIndex = (page - 1) * pageSize + idx + 1;
                  const isCurrent = currentUser && currentUser === row.username;
                  return (
                    <tr key={row.username} className={isCurrent ? "highlight" : undefined}>
                      <td className="rank">{globalIndex <= 3 ? (globalIndex === 1 ? "🥇 1st" : globalIndex === 2 ? "🥈 2nd" : "🥉 3rd") : `${globalIndex}th`}</td>
                      <td className="username">{row.username}</td>
                      <td className="games">{row.total_played}</td>
                      <td className="coins">{row.coins}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="pagination">
          <button className="page-btn prev" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Previous</button>
          <span className="page-info">Page {page} of {totalPages}</span>
          <button className="page-btn next" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next →</button>
        </div>
      </div>
    </div>
  );
}
