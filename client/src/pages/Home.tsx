import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "../assets/home.css"
import "../assets/styles.css"

export default function Home() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("Player");
    const [coins, setCoins] = useState<number | null>(null);
    const [totalPlayed, setTotalPlayed] = useState<number | null>(null);

    useEffect(() => {
        // Read session from localStorage (isolated per login, not shared across users)
        const storedUsername = localStorage.getItem("username");
        const userId = localStorage.getItem("userId");

        if (storedUsername) setUsername(storedUsername);

        if (userId) {
            fetch(`http://localhost:8000/api/users/${userId}`)
                .then(r => r.json())
                .then(data => {
                    if (data.username) setUsername(data.username);
                    if (typeof data.coins !== 'undefined') setCoins(data.coins);
                    if (typeof data.total_played !== 'undefined') setTotalPlayed(data.total_played);
                })
                .catch(() => { /* ignore */ });
        }
    }, []);

    async function handleLogout() {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        localStorage.removeItem("username");
        navigate("/");
    }

    return (
        <div className="page">
            {/* Navbar */}
            <nav className="navbar">
                <div className="navbar-left">
                    <Link to="/home" className="navbar-title">🎲 LUDO</Link>
                </div>
                <div className="navbar-right">
                    <div className="coin-display">
                        <span className="coin-icon">💰</span>
                        <span className="coin-amount">{coins !== null ? `${coins} Coins` : "-- Coins"}</span>
                    </div>
                    <div className="user-dropdown">
                        <button className="dropdown-btn">{username} ▼</button>
                        <div className="dropdown-menu">
                            <Link to="/update-profile" className="dropdown-item">Update Profile</Link>
                            <button className="dropdown-item logout-btn" onClick={handleLogout}>
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
            <div className="dashboard-container">
                <div className="dashboard-header">
                    <h2>Welcome, {username}!</h2>
                    <p>Choose an option below to continue</p>
                </div>
                <div className="dashboard-grid">
                    {/* Play Card */}
                    <div className="dashboard-card play-card">
                        <div className="card-icon">🎮</div>
                        <h3>Play Game</h3>
                        <p>Join a lobby and play with other players</p>
                        <Link to="/newgame/lobby" className="card-button">Start Playing</Link>
                    </div>
                    {/* Leaderboard Card */}
                    <div className="dashboard-card leaderboard-card">
                        <div className="card-icon">🏆</div>
                        <h3>Leaderboard</h3>
                        <p>Check global rankings and player stats</p>
                        <Link to="/leaderboard" className="card-button">View Rankings</Link>
                    </div>
                    {/* History Card */}
                    <div className="dashboard-card history-card">
                        <div className="card-icon">📊</div>
                        <h3>Game History</h3>
                        <p>Review your past matches and results</p>
                        <Link to="/history" className="card-button">View History</Link>
                    </div>
                </div>
                <div className="stats-section">
                    <h3>Your Stats</h3>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <span className="stat-label">Total Games</span>
                            <span className="stat-value">{totalPlayed ?? "--"}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Wins</span>
                            <span className="stat-value">8</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Win Rate</span>
                            <span className="stat-value">33%</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Total Coins</span>
                            <span className="stat-value">{coins ?? "--"}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}