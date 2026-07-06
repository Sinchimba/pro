import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { generateRoomId } from "../lib/roomId";
import {
  VideoIcon,
  LinkIcon,
  HandIcon,
  CaptionIcon,
  LogoutIcon,
} from "../components/icons";
import "./Dashboard.css";

interface DashboardProps {
  onJoin: (roomId: string) => void;
}

const ROLE_MESSAGES: Record<string, string> = {
  normal: "Speak and listen naturally — sign translation appears automatically for others.",
  deaf: "Spoken language will appear as sign translation and captions for you in every meeting.",
  mute: "Type or sign — your messages convert to speech and captions for everyone else.",
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Dashboard({ onJoin }: DashboardProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  if (!user) return null;

  const initial = user.name.charAt(0).toUpperCase();

  function handleCreate() {
    onJoin(generateRoomId());
  }

  function handleJoin() {
    const trimmed = joinCode.trim();
    if (trimmed) onJoin(trimmed);
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="brand">
          <span className="brand-mark">S</span>
          Smart Meeting
        </div>

        <div className="user-menu">
          <button
            className="user-menu-trigger"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="user-avatar">{initial}</span>
            <span className="user-menu-text">
              <span className="user-menu-name">{user.name}</span>
              <span className="user-role-badge">{user.role}</span>
            </span>
          </button>

          {menuOpen && (
            <div className="user-menu-dropdown">
              <button onClick={logout}>
                <LogoutIcon size={15} />
                Log out
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="dashboard-body">
        <div className="dashboard-greeting">
          <h1>
            {getGreeting()}, {user.name.split(" ")[0]}
          </h1>
          <p>
            You're signed in as a{" "}
            <span className="role-highlight">{user.role} user</span>.{" "}
            {ROLE_MESSAGES[user.role]}
          </p>
        </div>

        <div className="action-cards">
          <div className="action-card">
            <div className="action-card-icon">
              <VideoIcon size={22} />
            </div>
            <h3>Start a new meeting</h3>
            <p>
              Generates a unique link instantly — share it with anyone,
              anywhere.
            </p>
            <button className="action-card-primary-btn" onClick={handleCreate}>
              New Meeting
            </button>
          </div>

          <div className="action-card">
            <div className="action-card-icon">
              <LinkIcon size={22} />
            </div>
            <h3>Join with a code</h3>
            <p>Enter a meeting code someone shared with you.</p>
            <div className="join-input-row">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="e.g. swift-otter-4821"
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
              <button onClick={handleJoin} disabled={!joinCode.trim()}>
                Join
              </button>
            </div>
          </div>
        </div>

        <div className="getting-started">
          <h2>Getting started</h2>
          <div className="checklist">
            <div className="checklist-item">
              <span className="checklist-item-icon">
                <VideoIcon size={18} />
              </span>
              <span className="checklist-item-text">
                <strong>Allow camera & microphone access</strong>
                <span>You'll be prompted the moment you join a meeting.</span>
              </span>
            </div>
            <div className="checklist-item">
              <span className="checklist-item-icon">
                <HandIcon size={18} />
              </span>
              <span className="checklist-item-text">
                <strong>Sign translation runs automatically</strong>
                <span>No setup needed — it activates as soon as you speak or sign.</span>
              </span>
            </div>
            <div className="checklist-item">
              <span className="checklist-item-icon">
                <CaptionIcon size={18} />
              </span>
              <span className="checklist-item-text">
                <strong>Live captions for every participant</strong>
                <span>Spoken words appear as text in real time during the call.</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}