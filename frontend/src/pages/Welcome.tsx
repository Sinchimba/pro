import "./Welcome.css";

interface WelcomeProps {
  onSignUp: () => void;
  onLogIn: () => void;
}

export function Welcome({ onSignUp, onLogIn }: WelcomeProps) {
  return (
    <div className="welcome">
      <div className="welcome-content">
        <div className="eyebrow">
          <span className="pulse-dot" />
          Real-time · Inclusive · Two-way
        </div>
        <h1>
          Video meetings, <span>without communication barriers</span>
        </h1>
        <p className="welcome-subtitle">
          Smart Meeting connects hearing, deaf, and mute participants in the
          same live conversation — with real-time speech and sign language
          translation built in.
        </p>

        <div className="feature-row">
          <div className="feature-pill">
            <span className="feature-pill-icon">🎥</span>
            <span className="feature-pill-label">Live video calls</span>
          </div>
          <div className="feature-pill">
            <span className="feature-pill-icon">🤟</span>
            <span className="feature-pill-label">Sign translation</span>
          </div>
          <div className="feature-pill">
            <span className="feature-pill-icon">💬</span>
            <span className="feature-pill-label">Live captions</span>
          </div>
        </div>

        <div className="cta-row">
          <button className="cta-primary" onClick={onSignUp}>
            Sign Up
          </button>
          <button className="cta-secondary" onClick={onLogIn}>
            Log In
          </button>
        </div>
      </div>
    </div>
  );
}