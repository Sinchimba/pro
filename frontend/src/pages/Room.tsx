import { useWebRTC } from "../hooks/useWebRTC";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useSignMatcher } from "../hooks/useSignMatcher";
import { useGestureRecognition } from "../hooks/useGestureRecognition";
import { VideoCall } from "../components/VideoCall/VideoCall";
import { CaptionsOverlay } from "../components/Captions/CaptionsOverlay";
import { SignPanel } from "../components/SignPanel/SignPanel";
import { RecognitionPanel } from "../components/SignPanel/RecognitionPanel";
import { buildRoomLink } from "../lib/roomId";
import { useAuth } from "../context/AuthContext";
import "./Room.css";

interface RoomProps {
  roomId: string;
  onLeave: () => void;
}

export function Room({ roomId, onLeave }: RoomProps) {
  const { user } = useAuth();
  const userRole = user?.role || "normal";

  const {
    localStream,
    remoteStreams,
    joined,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    error,
  } = useWebRTC(roomId);

  const { transcript, isSupported } = useSpeechRecognition(
    joined && isAudioEnabled
  );

  const activeSign = useSignMatcher(transcript);

  const {
    result: recognitionResult,
    isLoading: recognitionLoading,
    loadError: recognitionError,
  } = useGestureRecognition(localStream, joined && isVideoEnabled);

  function handleCopyLink() {
    const link = buildRoomLink(roomId);
    navigator.clipboard.writeText(link).catch((err) => {
      console.error("Failed to copy link:", err);
    });
  }

  if (error) {
    return (
      <div className="room">
        <div className="room-header">
          <h2>
            Room <span className="room-code">{roomId}</span>
          </h2>
        </div>
        <div className="error-banner">{error}</div>
        <button className="leave-button" onClick={onLeave} style={{ marginTop: 16 }}>
          Leave
        </button>
      </div>
    );
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

      <div className="room-layout">
        <div className="room-main">
          <VideoCall
            localStream={localStream}
            remoteStreams={remoteStreams}
            isAudioEnabled={isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onLeave={onLeave}
            onCopyLink={handleCopyLink}
          />
        </div>
        <div className="room-sidebar">
          {(userRole === "deaf" || userRole === "normal") && (
            <SignPanel activeSign={activeSign} />
          )}
          {userRole === "mute" && (
            <RecognitionPanel
              result={recognitionResult}
              isLoading={recognitionLoading}
              loadError={recognitionError}
            />
          )}
        </div>
      </div>
      
      <CaptionsOverlay transcript={transcript} isSupported={isSupported} />
    </div>
  );
}
