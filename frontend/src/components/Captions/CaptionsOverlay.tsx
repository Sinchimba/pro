import "./CaptionsOverlay.css";

interface Caption {
  speakerName: string;
  text: string;
  type?: "Spoken" | "Sign";
}

interface CaptionsOverlayProps {
  caption: Caption | null;
  isSupported: boolean;
}

export function CaptionsOverlay({ caption, isSupported }: CaptionsOverlayProps) {
  if (!isSupported) {
    return (
      <div className="captions-overlay unsupported">
        Live captions aren't supported in this browser — try Chrome or Edge.
      </div>
    );
  }

  if (!caption || !caption.text) return null;

  const typeLabel = ` [${caption.type || "Spoken"}]`;

  return (
    <div className="captions-overlay">
      <span className="captions-speaker">{caption.speakerName}{typeLabel}:</span>
      <span className="captions-text">{caption.text}</span>
    </div>
  );
}
