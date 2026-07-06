import { useState } from "react";
import "./CallControls.css";

interface CallControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
  onCopyLink: () => void;
}

export function CallControls({
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeave,
  onCopyLink,
}: CallControlsProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    onCopyLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="call-controls">
      <button
        className={`control-button ${isAudioEnabled ? "" : "muted"}`}
        onClick={onToggleAudio}
        aria-pressed={!isAudioEnabled}
        title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        {isAudioEnabled ? <MicIcon /> : <MicOffIcon />}
        <span>{isAudioEnabled ? "Mute" : "Unmute"}</span>
      </button>

      <button
        className={`control-button ${isVideoEnabled ? "" : "muted"}`}
        onClick={onToggleVideo}
        aria-pressed={!isVideoEnabled}
        title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
      >
        {isVideoEnabled ? <CameraIcon /> : <CameraOffIcon />}
        <span>{isVideoEnabled ? "Stop video" : "Start video"}</span>
      </button>

      <button className="control-button" onClick={handleCopy}>
        {copied ? <CheckIcon /> : <LinkIcon />}
        <span>{copied ? "Copied!" : "Copy invite link"}</span>
      </button>

      <button className="control-button leave" onClick={onLeave}>
        <span>Leave</span>
      </button>
    </div>
  );
}

// Minimal inline icons — no external icon library dependency needed.
function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" strokeLinecap="round" />
      <path d="M12 19v3" strokeLinecap="round" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 1l22 22" strokeLinecap="round" />
      <path d="M9 9v3a3 3 0 0 0 4.6 2.5M15 6.5V5a3 3 0 0 0-5.9-.7" strokeLinecap="round" />
      <path d="M5 10a7 7 0 0 0 10.5 6M19 10a7 7 0 0 1-.4 2.3" strokeLinecap="round" />
      <path d="M12 19v3" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10l6-3v10l-6-3" strokeLinejoin="round" />
    </svg>
  );
}

function CameraOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 1l22 22" strokeLinecap="round" />
      <path d="M16 10l6-3v10l-6-3" strokeLinejoin="round" />
      <path d="M2 6h9a2 2 0 0 1 2 2v1M16 18H4a2 2 0 0 1-2-2V9" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" strokeLinecap="round" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}