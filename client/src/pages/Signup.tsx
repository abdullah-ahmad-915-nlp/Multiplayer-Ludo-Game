import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../assets/signup.css"
import "../assets/styles.css"

export default function Signup() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [dob, setDob] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e:React.FormEvent) {
        e.preventDefault();
        setError("");

        if (!username.trim() || !dob || !password || !confirmPassword) {
            setError("All fields are required.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("http://localhost:8000/api/auth/signup", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ username : username.trim(), dob, password, confirmPassword})
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.message ?? "Signup failed.");
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
                <p className="auth-subtitle">Create Your Account</p>
                </div>
                <div className="auth-card">
                <h2>Sign Up</h2>
                <form id="signup-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="username">Username</label>
                        <input
                        type="text"
                        id="username"
                        className="form-input"
                        placeholder="Choose a username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        minLength={2}
                        maxLength={20}
                        />
                    <span className="form-hint">Must be unique and 2-20 characters</span>
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="dob">Date of Birth</label>
                        <input
                        type="date"
                        id="dob"
                        className="form-input"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="password">Password</label>
                        <input
                        type="password"
                        id="password"
                        className="form-input"
                        placeholder="Enter a strong password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        />
                    <span className="form-hint">Minimum 6 characters</span>
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
                        <input
                        type="password"
                        id="confirm-password"
                        className="form-input"
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        />
                    </div>

                    {error && <span className="form-hint">{error}</span>}

                    <button type="submit" className="form-button" disabled={loading}>
                        {loading ? "Signing in..." : "Signup"}
                    </button>
                </form>
                <div className="auth-footer">
                    <p>Already have an account? <Link to="/login" className="auth-link">Login</Link></p>
                </div>
                </div>
            </div>
            </div>
    );
}
