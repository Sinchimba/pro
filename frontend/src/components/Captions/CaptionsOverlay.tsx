import "./CaptionsOverlay.css";

interface CaptionsOverlayProps {
  transcript: string;
  isSupported: boolean;
}

export function CaptionsOverlay({ transcript, isSupported }: CaptionsOverlayProps) {
  if (!isSupported) {
    return (
      <div className="captions-overlay unsupported">
        Live captions aren't supported in this browser — try Chrome or Edge.
      </div>
    );
  }

  if (!transcript) return null;

  return (
    <div className="captions-overlay">
      <div className="captions-label">
        <span className="pulse-dot" />
        Live captions
      </div>
      <div>{transcript}</div>
    </div>
  );
}
