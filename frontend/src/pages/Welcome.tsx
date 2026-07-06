import { VideoIcon, HandIcon, CaptionIcon, HearingUserIcon, DeafUserIcon, MuteUserIcon } from "../components/icons";
import "./Welcome.css";

interface WelcomeProps {
  onSignUp: () => void;
  onLogIn: () => void;
}

export function Welcome({ onSignUp, onLogIn }: WelcomeProps) {
  return (
    <div className="welcome-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="pulse-dot" />
            <span>Real-time · Inclusive · Two-way</span>
          </div>
          <h1 className="hero-title">
            Video meetings <span className="accent-text">without barriers</span>
          </h1>
          <p className="hero-description">
            Connect hearing, deaf, and mute participants in one conversation.
            Real-time speech-to-sign and captions for everyone.
          </p>

          <div className="cta-buttons">
            <button className="btn-primary" onClick={onSignUp}>
              Get Started Free
            </button>
            <button className="btn-secondary" onClick={onLogIn}>
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2>Why Smart Meeting?</h2>
        <div className="features-grid">
          {/* Feature 1 */}
          <div className="feature-card">
            <div className="feature-icon">
              <VideoIcon size={40} />
            </div>
            <h3>Live Video Calls</h3>
            <p>Crystal-clear video conferencing with real-time streaming across any network, optimized for accessibility.</p>
          </div>

          {/* Feature 2 */}
          <div className="feature-card">
            <div className="feature-icon">
              <HandIcon size={40} />
            </div>
            <h3>Sign Language Translation</h3>
            <p>Automatic real-time translation between spoken language and sign language, breaking down communication barriers.</p>
          </div>

          {/* Feature 3 */}
          <div className="feature-card">
            <div className="feature-icon">
              <CaptionIcon size={40} />
            </div>
            <h3>Live Captions</h3>
            <p>Accurate live captions for every word spoken in the meeting, ensuring no one misses important information.</p>
          </div>
        </div>
      </section>

      {/* User Types Section */}
      <section className="user-types-section">
        <h2>For Everyone</h2>
        <div className="user-types-grid">
          <div className="user-card">
            <div className="user-icon-svg">
              <HearingUserIcon size={64} />
            </div>
            <h3>Hearing Users</h3>
            <p>Speak naturally. Sign translation and captions appear automatically for others in the meeting.</p>
          </div>
          <div className="user-card">
            <div className="user-icon-svg">
              <DeafUserIcon size={64} />
            </div>
            <h3>Deaf Users</h3>
            <p>Spoken language will appear as sign translation and captions for you in every meeting.</p>
          </div>
          <div className="user-card">
            <div className="user-icon-svg">
              <MuteUserIcon size={64} />
            </div>
            <h3>Mute Users</h3>
            <p>Type or sign — your messages convert to speech and captions for everyone else.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="final-cta">
        <h2>Ready to connect without barriers?</h2>
        <p>Join Smart Meeting and start inclusive conversations today.</p>
        <button className="btn-large-primary" onClick={onSignUp}>
          Start Your Free Meeting
        </button>
      </section>
    </div>
  );
}