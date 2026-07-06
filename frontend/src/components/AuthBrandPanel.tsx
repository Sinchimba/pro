import { VideoIcon, HandIcon, CaptionIcon } from "./VideoCall/Icons";

interface AuthBrandPanelProps {
  heading: string;
  subtext: string;
}

export function AuthBrandPanel({ heading, subtext }: AuthBrandPanelProps) {
  return (
    <div className="auth-brand-panel">
      <div className="brand">
        <span className="brand-mark">S</span>
        Smart Meeting
      </div>
      <h2>{heading}</h2>
      <p>{subtext}</p>
      <div className="auth-brand-list">
        <div className="auth-brand-list-item">
          <VideoIcon size={18} />
          Live video across any network
        </div>
        <div className="auth-brand-list-item">
          <HandIcon size={18} />
          Real-time sign language translation
        </div>
        <div className="auth-brand-list-item">
          <CaptionIcon size={18} />
          Live captions for every conversation
        </div>
      </div>
    </div>
  );
}