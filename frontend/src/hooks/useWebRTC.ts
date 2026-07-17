import { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";
import { iceServers } from "../lib/iceServers";
import type { RemoteStream } from "../types";

interface ExistingUsersPayload {
  users: { socketId: string; name: string; videoOff: boolean; audioOff: boolean }[];
  hostSocketId: string;
}
interface UserJoinedPayload {
  socketId: string;
  name: string;
  videoOff: boolean;
  audioOff: boolean;
}

/**
 * Handles the full WebRTC lifecycle for a room:
 * - grabs local camera/mic
 * - connects to the signaling server and joins the room with a display name and userId
 * - creates a peer connection per remote participant (mesh topology)
 * - exchanges offer/answer/ICE candidates via the backend using queueing
 * - tracks who's the host, and everyone's display name and media status
 * - supports toggling audio/video and switching to screen share
 */
export function useWebRTC(roomId: string, displayName: string, enabled: boolean = true, userId?: number | null) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [joined, setJoined] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hostSocketId, setHostSocketId] = useState<string | null>(null);
  const [mySocketId, setMySocketId] = useState<string | null>(null);

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceCandidatesQueue = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);

  // Synchronize local socket ID state
  useEffect(() => {
    if (socket.id) {
      setMySocketId(socket.id);
    }
    const handleConnect = () => {
      setMySocketId(socket.id ?? null);
    };
    socket.on("connect", handleConnect);
    return () => {
      socket.off("connect", handleConnect);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let socketConnectHandler: (() => void) | null = null;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Camera access isn't available on this connection. If you're using an http:// LAN address instead of https:// or localhost, the browser blocks camera access for security reasons."
          );
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
        setLocalStream(stream);

        socketConnectHandler = () => {
          setMySocketId(socket.id ?? null);
          socket.emit("join-room", { roomId, displayName, userId });
          setJoined(true);
        };

        socket.connect();
        if (socket.connected) {
          socketConnectHandler();
        }
        socket.on("connect", socketConnectHandler);
      } catch (err) {
        if (!cancelled) {
          console.error("[useWebRTC] failed to start:", err);
          setError(
            err instanceof Error
              ? err.message
              : "Could not access camera/microphone."
          );
        }
      }
    }

    start();

    // Flush any queued ICE candidates for a peer connection that just had its remote description set
    const flushIceCandidates = async (remoteSocketId: string, pc: RTCPeerConnection) => {
      const queue = iceCandidatesQueue.current.get(remoteSocketId);
      if (queue && queue.length > 0) {
        for (const candidate of queue) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error(`[WebRTC] Failed to add queued ICE candidate for ${remoteSocketId}:`, err);
          }
        }
        iceCandidatesQueue.current.delete(remoteSocketId);
      }
    };

    function createPeerConnection(
      remoteSocketId: string,
      name: string,
      initialVideoOff = false,
      initialAudioOff = false
    ): RTCPeerConnection {
      const existingPc = peerConnections.current.get(remoteSocketId);
      if (existingPc) {
        try {
          existingPc.close();
        } catch (e) {
          console.warn("[WebRTC] Error closing existing peer connection:", e);
        }
        peerConnections.current.delete(remoteSocketId);
      }

      const pc = new RTCPeerConnection({ iceServers });

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.ontrack = (event) => {
        console.log(`[WebRTC] Received remote track:`, event.track.kind, `from:`, remoteSocketId);
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        const newStream = new MediaStream(remoteStream.getTracks());

        setRemoteStreams((prev) => {
          const exists = prev.some((r) => r.socketId === remoteSocketId);
          if (exists) {
            return prev.map((r) =>
              r.socketId === remoteSocketId ? { ...r, stream: newStream } : r
            );
          }
          return [...prev, { 
            socketId: remoteSocketId, 
            name, 
            stream: newStream, 
            videoOff: initialVideoOff, 
            audioOff: initialAudioOff 
          }];
        });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            targetSocketId: remoteSocketId,
            candidate: event.candidate,
          });
        }
      };

      peerConnections.current.set(remoteSocketId, pc);
      return pc;
    }

    async function callUser(remoteSocketId: string, name: string, videoOff = false, audioOff = false) {
      const pc = createPeerConnection(remoteSocketId, name, videoOff, audioOff);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { targetSocketId: remoteSocketId, offer });
    }

    function handleExistingUsers({ users, hostSocketId: hostId }: ExistingUsersPayload) {
      setHostSocketId(hostId);
      users.forEach(({ socketId, name, videoOff, audioOff }) => 
        callUser(socketId, name, videoOff, audioOff)
      );
    }

    function handleUserJoined({ socketId: _id, name: _name }: UserJoinedPayload) {
      // no-op; we wait for their offer.
    }

    async function handleOffer({
      fromSocketId,
      offer,
    }: {
      fromSocketId: string;
      offer: RTCSessionDescriptionInit;
    }) {
      const meta = pendingMeta.current.get(fromSocketId) || { name: "Guest", videoOff: false, audioOff: false };
      const pc = createPeerConnection(fromSocketId, meta.name, meta.videoOff, meta.audioOff);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushIceCandidates(fromSocketId, pc);
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { targetSocketId: fromSocketId, answer });
    }

    async function handleAnswer({
      fromSocketId,
      answer,
    }: {
      fromSocketId: string;
      answer: RTCSessionDescriptionInit;
    }) {
      const pc = peerConnections.current.get(fromSocketId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIceCandidates(fromSocketId, pc);
      }
    }

    async function handleIceCandidate({
      fromSocketId,
      candidate,
    }: {
      fromSocketId: string;
      candidate: RTCIceCandidateInit;
    }) {
      const pc = peerConnections.current.get(fromSocketId);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error(`[WebRTC] Failed to add ICE candidate for ${fromSocketId}:`, err);
        }
      } else {
        // Queue candidate if remote description is not set yet
        if (!iceCandidatesQueue.current.has(fromSocketId)) {
          iceCandidatesQueue.current.set(fromSocketId, []);
        }
        iceCandidatesQueue.current.get(fromSocketId)!.push(candidate);
      }
    }

    function handleUserLeft(remoteSocketId: string) {
      const pc = peerConnections.current.get(remoteSocketId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(remoteSocketId);
      }
      iceCandidatesQueue.current.delete(remoteSocketId);
      setRemoteStreams((prev) =>
        prev.filter((r) => r.socketId !== remoteSocketId)
      );
    }

    function handleHostChanged(newHostId: string) {
      setHostSocketId(newHostId);
    }

    // Track pending names and initial status for handleOffer
    const pendingMeta = { current: new Map<string, { name: string; videoOff: boolean; audioOff: boolean }>() };
    function trackMeta({ socketId, name, videoOff, audioOff }: UserJoinedPayload) {
      pendingMeta.current.set(socketId, { name, videoOff, audioOff });
    }

    function handleRoomFull({ roomId, max }: { roomId: string; max: number }) {
      setError(`Room "${roomId}" is full. Only a maximum of ${max} participants are allowed.`);
      setJoined(false);
      socket.disconnect();
    }

    // Remote media toggle events
    function handleUserVideoToggle({ socketId, enabled }: { socketId: string; enabled: boolean }) {
      setRemoteStreams((prev) =>
        prev.map((r) => (r.socketId === socketId ? { ...r, videoOff: !enabled } : r))
      );
    }

    function handleUserAudioToggle({ socketId, enabled }: { socketId: string; enabled: boolean }) {
      setRemoteStreams((prev) =>
        prev.map((r) => (r.socketId === socketId ? { ...r, audioOff: !enabled } : r))
      );
    }

    socket.on("existing-users", handleExistingUsers);
    socket.on("user-joined", trackMeta);
    socket.on("user-joined", handleUserJoined);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("user-left", handleUserLeft);
    socket.on("host-changed", handleHostChanged);
    socket.on("room-full", handleRoomFull);
    socket.on("user-video-toggle", handleUserVideoToggle);
    socket.on("user-audio-toggle", handleUserAudioToggle);

    return () => {
      cancelled = true;
      if (socketConnectHandler) {
        socket.off("connect", socketConnectHandler);
      }
      socket.off("existing-users", handleExistingUsers);
      socket.off("user-joined", trackMeta);
      socket.off("user-joined", handleUserJoined);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("user-left", handleUserLeft);
      socket.off("host-changed", handleHostChanged);
      socket.off("room-full", handleRoomFull);
      socket.off("user-video-toggle", handleUserVideoToggle);
      socket.off("user-audio-toggle", handleUserAudioToggle);

      socket.emit("leave-room");
      socket.disconnect();

      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      iceCandidatesQueue.current.clear();

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, displayName, enabled, userId]);

  function toggleAudio() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioEnabled(audioTrack.enabled);
      socket.emit("toggle-audio", { roomId, enabled: audioTrack.enabled });
    }
  }

  function toggleVideo() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
      socket.emit("toggle-video", { roomId, enabled: videoTrack.enabled });
    }
  }

  async function startScreenShare() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace the outgoing video track on every existing peer connection.
      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        sender?.replaceTrack(screenTrack);
      });

      // Also swap it into our own local stream so our own tile updates.
      if (localStreamRef.current && cameraTrackRef.current) {
        localStreamRef.current.removeTrack(cameraTrackRef.current);
        localStreamRef.current.addTrack(screenTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      setIsScreenSharing(true);

      // When the user stops sharing via the browser's own "Stop sharing"
      // control, automatically revert back to the camera.
      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      console.warn("[screen share] cancelled or failed:", err);
    }
  }

  function stopScreenShare() {
    const cameraTrack = cameraTrackRef.current;
    if (!cameraTrack) return;

    peerConnections.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      sender?.replaceTrack(cameraTrack);
    });

    if (localStreamRef.current) {
      const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (currentVideoTrack && currentVideoTrack !== cameraTrack) {
        localStreamRef.current.removeTrack(currentVideoTrack);
        currentVideoTrack.stop();
      }
      if (!localStreamRef.current.getVideoTracks().includes(cameraTrack)) {
        localStreamRef.current.addTrack(cameraTrack);
      }
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    }

    setIsScreenSharing(false);
  }

  return {
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
    mySocketId,
    isHost: hostSocketId !== null && hostSocketId === mySocketId,
  };
}