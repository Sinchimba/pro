import { useWebRTC } from "../hooks/useWebRTC";
import { VideoTile } from "../components/VideoCall/VideoTile";
import { CallControls } from "../components/VideoCall/CallControls";
import { buildRoomLink } from "../lib/roomId";
import "./Room.css";

interface RoomProps {
  roomId: string;
  onLeave: () => void;
}

export function Room({ roomId, onLeave }: RoomProps) {
  const {
    localStream,
    remoteStreams,
    joined,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
  } = useWebRTC(roomId);

  function handleCopyLink() {
    navigator.clipboard.writeText(buildRoomLink(roomId));
  }

  return (
    <div className="room">
      <div className="room-header">
        <h2>
          Room <span className="room-code">{roomId}</span>
        </h2>
        <span className={`status ${joined ? "connected" : "connecting"}`}>
          <span className="status-dot" />
          {joined ? "Connected" : "Connecting"}
        </span>
      </div>

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
          // share the invite link below so someone else can join…
        </p>
      )}

      <CallControls
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onLeave={onLeave}
        onCopyLink={handleCopyLink}
      />
    </div>
  );
}