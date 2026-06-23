import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../assets/login.css"
import "../assets/styles.css"

export default function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        if (!username.trim() || !password) {
            setError("Username and password are required.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("http://localhost:8000/api/auth/login", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ username : username.trim(), password})
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.message ?? "Login failed.");
                return;
            }

            // Store session in localStorage so each user's data is isolated per login
            localStorage.setItem("token", data.token);
            localStorage.setItem("userId", data.userId);
            localStorage.setItem("username", data.username ?? username.trim());
            navigate("/home");
        }
        catch (_err) {
            setError("Network error");
        }
        finally {
            setLoading(false);
        }
    }

    return (
        <div className="page">
            <div className="auth-container">
            <div className="auth-header">
                <h1 className="auth-title">🎲 LUDO</h1>
                <p className="auth-subtitle">Welcome Back</p>
            </div>

            <div className="auth-card">
                <h2>Login</h2>
                
                <form id="login-form" onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label" htmlFor="username">Username</label>
                    <input 
                    type="text" 
                    id="username" 
                    className="form-input"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={2}
                    maxLength={20}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="password">Password</label>
                    <input 
                    type="password" 
                    id="password" 
                    className="form-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    />
                </div>

                {error && <span className="form-hint">{error}</span>}

                <button type="submit" className="form-button" disabled={loading}>
                    {loading ? "Signing in..." : "Login"}
                </button>
                </form>

                <div className="auth-footer">
                <p>Don't have an account? <Link to="/signup" className="auth-link">Sign Up</Link></p>
                </div>
            </div>
            </div>
        </div>
    );
}