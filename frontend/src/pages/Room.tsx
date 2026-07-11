import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useWebRTC } from "../hooks/useWebRTC";
import { socket } from "../lib/socket";
import { useActiveSpeaker } from "../hooks/useActiveSpeaker";
import { useChat } from "../hooks/useChat";
import { useRaiseHand } from "../hooks/useRaiseHand";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useSignMatcher, type TranscriptAction } from "../hooks/useSignMatcher";
import { useGestureRecognition } from "../hooks/useGestureRecognition";
import { CaptionsOverlay } from "../components/Captions/CaptionsOverlay";
import { SignPanel } from "../components/SignPanel/SignPanel";
import { RecognitionPanel } from "../components/SignPanel/RecognitionPanel";
import { ChatPanel } from "../components/VideoCall/ChatPanel";
import { ReactionOverlay } from "../components/VideoCall/ReactionOverlay";
import { TranslationPanel } from "../components/VideoCall/TranslationPanel";
import { SignTranslationPanel } from "../components/VideoCall/SignTranslationPanel";
import { BackgroundSettings } from "../components/VideoCall/BackgroundSettings";
import type { BackgroundEffect } from "../components/VideoCall/BackgroundSettings";
import {
  CopyIcon,
  CheckIcon,
  CrownIcon,
  ScreenShareIcon,
  ChatBubbleIcon,
  HandRaiseIcon,
  RecordIcon,
  PhoneOffIcon,
  MicIcon,
  VideoIcon,
  SmileIcon,
  SettingsIcon,
  SunIcon,
  MoonIcon,
  UsersIcon,
  ShieldLockIcon,
  MirrorIcon,
} from "../components/VideoCall/Icons";
import { buildRoomLink } from "../lib/roomId";
import "./Room.css";

interface RoomProps {
  roomId: string;
  onLeave: () => void;
}

interface Tile {
  id: string; // "local" or a remote socketId
  name: string;
  stream: MediaStream | null;
  videoOff: boolean;
  isHost: boolean;
  handRaised: boolean;
}

type LayoutMode = "grid" | "spotlight" | "sidebar";

export function Room({ roomId, onLeave }: RoomProps) {
  const { user } = useAuth();
  const myName = user?.name || "You";

  const {
    localStream,
    remoteStreams,
    joined,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    error,
    hostSocketId,
    isHost,
  } = useWebRTC(roomId, myName);

  const activeSpeakerId = useActiveSpeaker(localStream, remoteStreams);
  const { messages, sendMessage, unreadCount, markAllRead } = useChat(
    roomId,
    myName
  );
  const { isHandRaised, othersRaised, toggleHand } = useRaiseHand(roomId);

  const { transcript, isSupported } = useSpeechRecognition(
    joined && isAudioEnabled
  );

  const [lastTranscriptAction, setLastTranscriptAction] = useState<TranscriptAction | null>(null);

  // Update last active transcript action when local user speaks
  useEffect(() => {
    if (transcript) {
      setLastTranscriptAction({
        text: transcript,
        timestamp: Date.now(),
        senderId: "local",
      });
    }
  }, [transcript]);

  // Share our local transcript with remote members
  useEffect(() => {
    if (joined && transcript) {
      socket.emit("speech-transcript", { roomId, transcript });
    }
  }, [transcript, joined, roomId]);

  // Listen to remote transcripts
  useEffect(() => {
    function handleIncomingTranscript({
      socketId,
      transcript: text,
    }: {
      socketId: string;
      transcript: string;
    }) {
      if (text) {
        setLastTranscriptAction({
          text,
          timestamp: Date.now(),
          senderId: socketId,
        });
      }
    }

    socket.on("speech-transcript", handleIncomingTranscript);

    return () => {
      socket.off("speech-transcript", handleIncomingTranscript);
    };
  }, []);

  const activeSign = useSignMatcher(lastTranscriptAction);
  const {
    result: recognitionResult,
    isLoading: recognitionLoading,
    loadError: recognitionError,
  } = useGestureRecognition(localStream, joined && isVideoEnabled);

  // Redesign state variables
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [backgroundSettingsOpen, setBackgroundSettingsOpen] = useState(false);
  const [reactionPopoverOpen, setReactionPopoverOpen] = useState(false);
  const [layout, setLayout] = useState<LayoutMode>("grid");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isPerformanceMode, setIsPerformanceMode] = useState(false);

  // Video mirror toggle state per tile
  const [mirroredTiles, setMirroredTiles] = useState<Record<string, boolean>>({});

  // Background and Canvas effects state
  const [bgEffect, setBgEffect] = useState<BackgroundEffect>("none");
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Meeting start time and recording state
  const [startTime] = useState(() =>
    new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Throttled live captions state using requestAnimationFrame
  const [throttledTranscript, setThrottledTranscript] = useState("");
  const rAFRef = useRef<number | null>(null);

  useEffect(() => {
    if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
    rAFRef.current = requestAnimationFrame(() => {
      setThrottledTranscript(transcript);
    });
    return () => {
      if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
    };
  }, [transcript]);

  // Track active sign translations for each user tile
  const [activeTranslations, setActiveTranslations] = useState<Record<string, { word: string; timestamp: number }>>({});

  // Socket listener for incoming sign translations
  useEffect(() => {
    function handleIncomingTranslation({
      socketId,
      word,
    }: {
      socketId: string;
      name: string;
      word: string;
      confidence: number;
      mode: string;
    }) {
      // 1. Show the translation on the sender's video tile
      setActiveTranslations((prev) => ({
        ...prev,
        [socketId]: { word, timestamp: Date.now() },
      }));

      // 2. Clear translation badge after 3 seconds of inactivity
      setTimeout(() => {
        setActiveTranslations((prev) => {
          const current = prev[socketId];
          if (current && Date.now() - current.timestamp >= 3000) {
            const next = { ...prev };
            delete next[socketId];
            return next;
          }
          return prev;
        });
      }, 3000);

      // 3. Play Text-to-Speech (TTS) for other users' sign translations
      if (socketId !== socket.id) {
        const utterance = new SpeechSynthesisUtterance(word);
        window.speechSynthesis.speak(utterance);
      }
    }

    socket.on("sign-translation", handleIncomingTranslation);
    return () => {
      socket.off("sign-translation", handleIncomingTranslation);
      window.speechSynthesis.cancel();
    };
  }, []);

  // Watch for mute user's local gesture recognition and broadcast it
  useEffect(() => {
    if (joined && recognitionResult && recognitionResult.text) {
      socket.emit("sign-translation", {
        roomId,
        word: recognitionResult.text,
        confidence: 1.0,
        mode: "local",
      });
      setActiveTranslations((prev) => ({
        ...prev,
        local: { word: recognitionResult.text, timestamp: Date.now() },
      }));
      setTimeout(() => {
        setActiveTranslations((prev) => {
          const current = prev.local;
          if (current && Date.now() - current.timestamp >= 3000) {
            const next = { ...prev };
            delete next.local;
            return next;
          }
          return prev;
        });
      }, 3000);
    }
  }, [recognitionResult, joined, roomId]);

  // Local stream background processing canvas pipeline
  useEffect(() => {
    if (!localStream) {
      setProcessedStream(null);
      return;
    }

    if (bgEffect === "none" || isPerformanceMode) {
      setProcessedStream(localStream);
      return;
    }

    const video = document.createElement("video");
    video.srcObject = localStream;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => { });

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");

    const bgImage = new Image();
    bgImage.crossOrigin = "anonymous";
    if (bgEffect === "bg-office") {
      bgImage.src = "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=640&q=80";
    } else if (bgEffect === "bg-beach") {
      bgImage.src = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=640&q=80";
    }

    function processFrame() {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (bgEffect === "blur-soft" || bgEffect === "blur-deep") {
        ctx.filter = bgEffect === "blur-soft" ? "blur(6px)" : "blur(14px)";
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } else if (bgEffect.startsWith("bg-") && bgImage.src) {
        ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        ctx.filter = "none";
        ctx.save();
        ctx.beginPath();
        // Central crop avatar shape of user
        ctx.arc(canvas.width / 2, canvas.height / 2 + 25, 120, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(video, canvas.width / 2 - 160, canvas.height / 2 - 100, 320, 260);
        ctx.restore();
      } else {
        ctx.filter = "none";
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    }

    video.onloadedmetadata = () => {
      processFrame();
    };

    const canvasStream = canvas.captureStream(30);
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      canvasStream.addTrack(audioTrack);
    }

    setProcessedStream(canvasStream);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      video.pause();
      video.srcObject = null;
    };
  }, [localStream, bgEffect, isPerformanceMode]);

  // Screen recording handler using MediaRecorder
  function toggleRecording() {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    } else {
      const streamToRecord = processedStream || localStream;
      if (!streamToRecord) return;

      recordedChunksRef.current = [];
      try {
        const mediaRecorder = new MediaRecorder(streamToRecord, {
          mimeType: "video/webm;codecs=vp9,opus",
        });
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `meeting-recording-${roomId}-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        };
        mediaRecorder.start(1000);
        setIsRecording(true);
      } catch (err) {
        console.warn("Retrying recording with default codecs:", err);
        try {
          const mediaRecorder = new MediaRecorder(streamToRecord);
          mediaRecorderRef.current = mediaRecorder;
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunksRef.current.push(e.data);
          };
          mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `meeting-recording-${roomId}-${Date.now()}.webm`;
            a.click();
            URL.revokeObjectURL(url);
          };
          mediaRecorder.start(1000);
          setIsRecording(true);
        } catch (e) {
          console.error("Recording initialization failed completely:", e);
        }
      }
    }
  }

  // Trigger floating reactions locally and emit
  function triggerReaction(emoji: string) {
    const event = new CustomEvent("local-reaction", { detail: emoji });
    window.dispatchEvent(event);
    setReactionPopoverOpen(false);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(buildRoomLink(roomId));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleChat() {
    setChatOpen((open) => {
      if (!open) markAllRead();
      return !open;
    });
  }

  function toggleMirror(id: string) {
    setMirroredTiles((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  if (error) {
    return (
      <div className="meeting-room">
        <div className="mr-error-screen">
          <div className="mr-error-message">{error}</div>
          <button className="mr-tool-btn end-call" onClick={onLeave}>
            Leave
          </button>
        </div>
      </div>
    );
  }

  const tiles: Tile[] = [
    {
      id: "local",
      name: `${myName} (You)`,
      stream: processedStream || localStream,
      videoOff: !isVideoEnabled,
      isHost,
      handRaised: isHandRaised,
    },
    ...remoteStreams.map((r) => ({
      id: r.socketId,
      name: r.name,
      stream: r.stream,
      videoOff: false,
      isHost: r.socketId === hostSocketId,
      handRaised: othersRaised.has(r.socketId),
    })),
  ];

  const hasActiveSpeaker =
    tiles.length > 1 &&
    activeSpeakerId !== null &&
    (activeSpeakerId === "local" ||
      remoteStreams.some((r) => r.socketId === activeSpeakerId));

  // Handle layouts filtering
  let renderedTiles = tiles;
  if (layout === "spotlight") {
    // Only render active speaker, or local tile if no active speaker
    const speaker = tiles.find((t) => t.id === activeSpeakerId) || tiles.find((t) => t.id === "local") || tiles[0];
    renderedTiles = speaker ? [speaker] : [];
  }

  return (
    <div
      className={`meeting-room ${isDarkMode ? "dark-theme" : "light-theme"} ${isPerformanceMode ? "performance-mode" : ""}`}
    >
      {/* Top Header Bar */}
      <div className="mr-topbar">
        <div className="mr-header-left">
          <ShieldLockIcon size={16} className="security-lock" />
          <span className="mr-meeting-id">Meeting ID: {roomId}</span>
          <span className="mr-start-time">Started at {startTime}</span>
        </div>

        <div className="mr-header-center">
          <button className="mr-link-copy" onClick={handleCopyLink}>
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            <span>{copied ? "Copied!" : buildRoomLink(roomId)}</span>
          </button>
        </div>

        <div className="mr-header-right">
          <span className="mr-host-badge">
            <CrownIcon size={14} className="crown" />
            <span>Host: {isHost ? "You" : "—"}</span>
          </span>

          <span className="mr-status-dot-row">
            <span className={`mr-status-dot ${joined ? "" : "connecting"}`} />
            <span>{joined ? "Live" : "Reconnecting"}</span>
          </span>

          {/* Theme & Performance toggles */}
          <button
            className="header-toggle-btn"
            onClick={() => setIsDarkMode((v) => !v)}
            title="Toggle theme"
          >
            {isDarkMode ? <SunIcon size={16} /> : <MoonIcon size={16} />}
          </button>

          <button
            className={`header-toggle-btn performance-badge ${isPerformanceMode ? "active" : ""}`}
            onClick={() => setIsPerformanceMode((v) => !v)}
            title="Performance Mode (Disable blurs & optimize speed)"
          >
            🚀 {isPerformanceMode ? "Perf Mode: ON" : "Normal Mode"}
          </button>
        </div>
      </div>

      <div className="mr-body">
        <div className="mr-main">
          {/* Main Video Display Area with dynamic layout classes */}
          <div className={`mr-video-container layout-${layout}`}>
            <div
              className={`mr-video-grid ${hasActiveSpeaker ? "has-active-speaker" : ""}`}
            >
              {renderedTiles.map((tile) => (
                <VideoTileCard
                  key={tile.id}
                  tile={tile}
                  isSpeaker={activeSpeakerId === tile.id}
                  isMirrored={!!mirroredTiles[tile.id]}
                  onToggleMirror={() => toggleMirror(tile.id)}
                  activeTranslation={activeTranslations[tile.id === "local" ? "local" : tile.id]?.word}
                />
              ))}
            </div>
          </div>

          {/* Real-time floating non-intrusive language translator */}
          <TranslationPanel transcript={throttledTranscript} />

          {/* Floating Sign Language Translation Panel (Draggable & Resizable) */}
          <SignTranslationPanel
            stream={localStream}
            onTranslation={(word, confidence, mode) => {
              if (joined) {
                // Emit to other users
                socket.emit("sign-translation", {
                  roomId,
                  word,
                  confidence,
                  mode,
                });
                // Update local tile overlay
                setActiveTranslations((prev) => ({
                  ...prev,
                  local: { word, timestamp: Date.now() },
                }));
                // Automatically clear local translation after 3 seconds
                setTimeout(() => {
                  setActiveTranslations((prev) => {
                    const current = prev.local;
                    if (current && Date.now() - current.timestamp >= 3000) {
                      const next = { ...prev };
                      delete next.local;
                      return next;
                    }
                    return prev;
                  });
                }, 3000);
              }
            }}
          />

          {/* Floating reactions animations overlay */}
          <ReactionOverlay roomId={roomId} />
        </div>

        {/* Dedicated Accessibility Panel on the right side of the video layout */}
        <div className="mr-accessibility-panel">
          <SignPanel activeSign={activeSign} />
          <RecognitionPanel
            result={recognitionResult}
            isLoading={recognitionLoading}
            loadError={recognitionError}
          />
        </div>

        {/* Slide-out Google Meet-style participant panel */}
        <div className={`mr-sidebar-slide ${participantsOpen ? "open" : ""}`}>
          <div className="mr-sidebar-header">
            <span>Participants ({tiles.length})</span>
            <button onClick={() => setParticipantsOpen(false)} aria-label="Close sidebar">
              ×
            </button>
          </div>
          <div className="mr-participant-list">
            {tiles.map((tile) => (
              <div
                className={`mr-participant-row ${activeSpeakerId === tile.id ? "speaking" : ""}`}
                key={tile.id}
              >
                <span className="mr-participant-avatar">
                  {tile.name.charAt(0).toUpperCase()}
                </span>
                <div className="mr-participant-info">
                  <span className="mr-participant-name">{tile.name}</span>
                  {tile.isHost && (
                    <span className="mr-host-pill">
                      <CrownIcon size={10} />
                      Host
                    </span>
                  )}
                </div>
                <div className="mr-participant-badges">
                  {tile.handRaised && <HandRaiseIcon size={14} />}
                  <span className="mr-participant-status-icon">
                    {tile.videoOff ? "🚫" : "📷"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom control bar */}
      <div className="mr-toolbar">
        <div className="mr-toolbar-left">
          <span className="mr-meeting-code">{roomId}</span>
          <button
            className={`mr-copy-link-btn ${copied ? "copied" : ""}`}
            onClick={handleCopyLink}
            title="Copy meeting link"
          >
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            <span>{copied ? "Copied!" : "Copy link"}</span>
          </button>
        </div>

        <div className="mr-toolbar-center">
          <button
            className={`mr-tool-btn ${isAudioEnabled ? "mic-active" : "active-off"}`}
            onClick={toggleAudio}
            title={isAudioEnabled ? "Mute Microphone" : "Unmute Microphone"}
          >
            <MicIcon size={20} active={isAudioEnabled} />
          </button>

          <button
            className={`mr-tool-btn ${isVideoEnabled ? "video-active" : "active-off"}`}
            onClick={toggleVideo}
            title={isVideoEnabled ? "Stop Camera" : "Start Camera"}
          >
            <VideoIcon size={20} active={isVideoEnabled} />
          </button>

          <button
            className={`mr-tool-btn ${isScreenSharing ? "active-on" : ""}`}
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
          >
            <ScreenShareIcon size={20} />
          </button>

          <button
            className={`mr-tool-btn ${isHandRaised ? "active-on" : ""}`}
            onClick={toggleHand}
            title={isHandRaised ? "Lower hand" : "Raise hand"}
          >
            <HandRaiseIcon size={20} />
          </button>

          {/* Chat Toggle Button with unread counts */}
          <div className="mr-tool-wrap">
            <button
              className={`mr-tool-btn ${chatOpen ? "active-on" : ""}`}
              onClick={toggleChat}
              title="Chat"
            >
              <ChatBubbleIcon size={20} />
            </button>
            {unreadCount > 0 && !chatOpen && (
              <span className="mr-tool-badge">{unreadCount}</span>
            )}
          </div>

          {/* Reactions menu popover */}
          <div className="mr-tool-wrap">
            <button
              className="mr-tool-btn"
              onClick={() => setReactionPopoverOpen((v) => !v)}
              title="Send reaction"
            >
              <SmileIcon size={20} />
            </button>
            {reactionPopoverOpen && (
              <div className="mr-reaction-popover">
                {["👍", "👏", "❤️", "🎉", "😮", "😂"].map((emoji) => (
                  <button
                    key={emoji}
                    className="mr-reaction-popover-btn"
                    onClick={() => triggerReaction(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Video Visual backgrounds settings toggle */}
          <button
            className={`mr-tool-btn ${bgEffect !== "none" ? "active-on" : ""}`}
            onClick={() => setBackgroundSettingsOpen((v) => !v)}
            title="Virtual backgrounds & Blur"
          >
            <SettingsIcon size={20} />
          </button>

          {/* Screen/Camera Recording controller with red flashing indicator */}
          <button
            className={`mr-tool-btn recording-toggle-btn ${isRecording ? "recording" : ""}`}
            onClick={toggleRecording}
            title={isRecording ? "Stop screen recording" : "Record meeting"}
          >
            <RecordIcon size={20} active={isRecording} />
            {isRecording && <span className="recording-pulse-indicator" />}
          </button>

          <button className="mr-tool-btn end-call-btn" onClick={onLeave} title="End Call">
            <PhoneOffIcon size={20} />
          </button>
        </div>

        <div className="mr-toolbar-right">
          {/* Layout switching option buttons */}
          <div className="mr-layout-controls">
            <button
              className={`layout-btn ${layout === "grid" ? "active" : ""}`}
              onClick={() => setLayout("grid")}
              title="Grid view"
            >
              Grid
            </button>
            <button
              className={`layout-btn ${layout === "spotlight" ? "active" : ""}`}
              onClick={() => setLayout("spotlight")}
              title="Spotlight view"
            >
              Spotlight
            </button>
            <button
              className={`layout-btn ${layout === "sidebar" ? "active" : ""}`}
              onClick={() => setLayout("sidebar")}
              title="Sidebar view"
            >
              Sidebar
            </button>
          </div>

          {/* Participant Count triggers the slide-out participants drawer */}
          <button
            className={`mr-tool-btn mr-participants-btn ${participantsOpen ? "active-on" : ""}`}
            onClick={() => setParticipantsOpen((v) => !v)}
            title="View participants"
          >
            <UsersIcon size={20} />
            <span className="btn-participants-count">{tiles.length}</span>
          </button>
        </div>
      </div>

      {/* Floating Chat container */}
      {chatOpen && (
        <ChatPanel
          messages={messages}
          onSend={sendMessage}
          onClose={() => setChatOpen(false)}
        />
      )}

      {/* Floating Visual background settings dialog */}
      {backgroundSettingsOpen && (
        <BackgroundSettings
          currentEffect={bgEffect}
          onChangeEffect={(effect) => {
            setBgEffect(effect);
            setBackgroundSettingsOpen(false);
          }}
          onClose={() => setBackgroundSettingsOpen(false)}
        />
      )}

      <CaptionsOverlay transcript={throttledTranscript} isSupported={isSupported} />
    </div>
  );
}

function VideoTileCard({
  tile,
  isSpeaker,
  isMirrored,
  onToggleMirror,
  activeTranslation,
}: {
  tile: Tile;
  isSpeaker: boolean;
  isMirrored: boolean;
  onToggleMirror: () => void;
  activeTranslation?: string;
}) {
  return (
    <div
      className={`mr-tile ${isSpeaker ? "is-speaker" : ""} ${isMirrored ? "mirrored" : ""}`}
    >
      {tile.stream && !tile.videoOff && (
        <VideoElement stream={tile.stream} muted={tile.id === "local"} />
      )}

      {tile.stream && !tile.videoOff && (
        <button
          className="mr-tile-mirror-btn"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMirror();
          }}
          title="Toggle mirror view"
        >
          <MirrorIcon size={12} />
        </button>
      )}

      {(!tile.stream || tile.videoOff) && (
        <div className="mr-tile-off-overlay">
          <span className="mr-avatar-circle">
            {tile.name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      {tile.handRaised && (
        <span className="mr-hand-raised-badge">
          <HandRaiseIcon size={14} />
        </span>
      )}
      {activeTranslation && (
        <div className="tile-translation-bubble">
          <span className="translation-text-content">{activeTranslation}</span>
        </div>
      )}
      <div className="mr-tile-name-bar">
        <span>{tile.name}</span>
        {tile.isHost && <CrownIcon size={14} className="crown" />}
      </div>
    </div>
  );
}

function VideoElement({
  stream,
  muted,
}: {
  stream: MediaStream;
  muted: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
    />
  );
}