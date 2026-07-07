import { VideoTile } from "./VideoTile";
import { CallControls } from "./CallControls";
import type { RemoteStream } from "../../types";

interface VideoCallProps {
  localStream: MediaStream | null;
  remoteStreams: RemoteStream[];
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
  onCopyLink: () => void;
}

export function VideoCall({
  localStream,
  remoteStreams,
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeave,
  onCopyLink,
}: VideoCallProps) {
  return (
    <div className="video-call-container">
      <div className="video-grid">
        {localStream && (
          <VideoTile
            stream={localStream}
            label="You"
            muted
            videoOff={!isVideoEnabled}
          />
        )}
        {remoteStreams.map((r) => (
          <VideoTile key={r.socketId} stream={r.stream} label={r.socketId} />
        ))}
      </div>

      {remoteStreams.length === 0 && (
        <p className="empty-state">
          Share the invite link below so someone else can join...
        </p>
      )}

      <CallControls
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        onToggleAudio={onToggleAudio}
        onToggleVideo={onToggleVideo}
        onLeave={onLeave}
        onCopyLink={onCopyLink}
      />
    </div>
  );
}
