import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../assets/update-profile.css";
import "../assets/styles.css"

export default function UpdateProfile() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [dob, setDob] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = document.cookie.match(/(?:^|; )token=([^;]+)/)?.[1];
    const userId = token && token.startsWith("token_") ? token.replace("token_", "") : null;
    if (!userId) return;

    fetch(`http://localhost:8000/api/users/${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.username) setUsername(data.username);
        if (data.dob) setDob(new Date(data.dob).toISOString().slice(0, 10));
      })
      .catch(() => {});
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword || confirmNewPassword) {
      if (!currentPassword) {
        setError("Current password is required to change password");
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setError("New passwords do not match");
        return;
      }
    }

    const token = document.cookie.match(/(?:^|; )token=([^;]+)/)?.[1];
    const userId = token && token.startsWith("token_") ? token.replace("token_", "") : null;
    if (!userId) {
      setError("Not logged in");
      return;
    }

    setLoading(true);

    // Build payload only with fields that should be updated
    const payload: any = {};
    if (dob) payload.dob = dob;
    if (newPassword || confirmNewPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
      payload.confirmPassword = confirmNewPassword;
    }

    // If no fields are provided, don't call the API; inform the user
    if (Object.keys(payload).length === 0) {
      setMessage("No changes to save");
      return;
    }

    fetch(`http://localhost:8000/api/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Update failed");
        setMessage("Profile updated successfully");
        setTimeout(() => navigate("/home"), 900);
      })
      .catch((err) => setError(err.message || "Error"))
      .finally(() => setLoading(false));
  }

  return (
    <div className="page">
      <nav className="navbar">
        <div className="navbar-left">
          <Link to="/home" className="navbar-title">🎲 LUDO</Link>
        </div>
      </nav>

      <div className="profile-container">
        <div className="profile-header">
          <h2>Update Profile</h2>
          <p>Edit your account information</p>
        </div>

        <div className="profile-card">
          <form id="update-profile-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input type="text" id="username" className="form-input" value={username} readOnly />
              <span className="form-hint">Cannot be changed after account creation</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="dob">Date of Birth</label>
              <input type="date" id="dob" className="form-input" value={dob} onChange={(e) => setDob(e.target.value)} required />
            </div>

            <div className="form-divider"><span>Change Password (Optional)</span></div>

            <div className="form-group">
              <label className="form-label" htmlFor="current-password">Current Password</label>
              <input type="password" id="current-password" className="form-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new-password">New Password</label>
              <input type="password" id="new-password" className="form-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-new-password">Confirm New Password</label>
              <input type="password" id="confirm-new-password" className="form-input" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
            </div>

            {error && <div className="form-hint" style={{ color: 'red' }}>{error}</div>}
            {message && <div className="form-hint" style={{ color: 'green' }}>{message}</div>}

            <div className="form-actions">
              <button type="submit" className="btn-save" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</button>
              <button type="button" className="btn-cancel" onClick={() => navigate('/home')}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
