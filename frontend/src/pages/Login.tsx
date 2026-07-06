import { useState } from "react";
import { login } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AuthBrandPanel } from "../components/AuthBrandPanel";
import "./AuthForm.css";

interface LoginProps {
  onSuccess: () => void;
  onSwitchToSignUp: () => void;
  onBack: () => void;
}

export function Login({ onSuccess, onSwitchToSignUp, onBack }: LoginProps) {
  const { setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = email && password;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const { user, token } = await login(email, password);
      setAuth(user, token);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Log in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <AuthBrandPanel
        heading="Welcome back."
        subtext="Log in to jump straight into your next meeting — or open an invite link to join one already in progress."
      />

      <div className="auth-form-panel">
        <div className="auth-card">
          <button className="auth-back" onClick={onBack}>
            ← Back
          </button>
          <h1>Welcome back</h1>
          <p>Log in to join or start a meeting.</p>

          {error && <div className="error-banner">{error}</div>}

          <div className="field-group">
            <label className="field-label">Email</label>
            <input
              className="field-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="field-group">
            <label className="field-label">Password</label>
            <input
              className="field-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
          >
            {loading ? "Logging in..." : "Log In"}
          </button>

          <div className="auth-switch">
            Don't have an account?{" "}
            <button onClick={onSwitchToSignUp}>Sign Up</button>
          </div>
        </div>
      </div>
    </div>
  );
}