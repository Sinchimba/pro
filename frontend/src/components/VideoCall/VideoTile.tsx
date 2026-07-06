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
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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