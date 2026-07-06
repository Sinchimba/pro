import { useState } from "react";
import { signup } from "../lib/api";
import type { Role } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AuthBrandPanel } from "../components/AuthBrandPanel";
import "./AuthForm.css";

interface SignUpProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
  onBack: () => void;
}

const ROLES: { value: Role; label: string; icon: string }[] = [
  { value: "normal", label: "Normal User", icon: "🗣️" },
  { value: "deaf", label: "Deaf User", icon: "🤟" },
  { value: "mute", label: "Mute User", icon: "⌨️" },
];

export function SignUp({ onSuccess, onSwitchToLogin, onBack }: SignUpProps) {
  const { setAuth } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = name && email && password.length >= 6 && role;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const { user, token } = await signup(name, email, password, role!);
      setAuth(user, token);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <AuthBrandPanel
        heading="Join a conversation that includes everyone."
        subtext="Create an account and tell us how you communicate, so we can tailor every meeting for you."
      />

      <div className="auth-form-panel">
        <div className="auth-card">
          <button className="auth-back" onClick={onBack}>
            ← Back
          </button>
          <h1>Create your account</h1>
          <p>Tell us how you communicate so we can tailor the meeting for you.</p>

          {error && <div className="error-banner">{error}</div>}

          <div className="field-group">
            <label className="field-label">Full name</label>
            <input
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

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
              placeholder="At least 6 characters"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <div className="field-group">
            <label className="field-label">I am a...</label>
            <div className="role-options">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={`role-option ${role === r.value ? "selected" : ""}`}
                  onClick={() => setRole(r.value)}
                >
                  <span className="role-option-icon">{r.icon}</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>

          <div className="auth-switch">
            Already have an account?{" "}
            <button onClick={onSwitchToLogin}>Log In</button>
          </div>
        </div>
      </div>
    </div>
  );
}