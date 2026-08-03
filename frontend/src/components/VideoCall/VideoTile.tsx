import { useEffect, useRef } from "react";
import "./VideoTile.css";

interface VideoTileProps {
  stream: MediaStream;
  label: string;
  muted?: boolean;
  videoOff?: boolean;
}

export function VideoTile({
  stream,
  label,
  muted = false,
  videoOff = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.srcObject = stream;
      videoEl.play().catch((err) => {
        console.warn(`[VideoTile] Autoplay/playback blocked for "${label}":`, err);
      });
    }
  }, [stream, label]);

  return (
    <div className={`video-tile ${muted ? "self" : ""}`}>
      <video ref={videoRef} autoPlay playsInline muted={muted} />
      {videoOff && (
        <div className="video-off-overlay">
          <span className="avatar-circle">{label.charAt(0).toUpperCase()}</span>
        </div>
      )}
      <span className="video-tile-label">{label}</span>
    </div>
  );
}