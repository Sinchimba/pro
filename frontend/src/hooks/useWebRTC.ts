import { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";
import { iceServers } from "../lib/iceServers";
import type { RemoteStream } from "../types";

interface ExistingUsersPayload {
  users: { socketId: string; name: string }[];
  hostSocketId: string;
}
interface UserJoinedPayload {
  socketId: string;
  name: string;
}

/**
 * Handles the full WebRTC lifecycle for a room:
 * - grabs local camera/mic
 * - connects to the signaling server and joins the room with a display name
 * - creates a peer connection per remote participant (mesh topology)
 * - exchanges offer/answer/ICE candidates via the backend
 * - tracks who's the host, and everyone's display name
 * - supports toggling audio/video and switching to screen share
 */
export function useWebRTC(roomId: string, displayName: string) {
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
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    let cancelled = false;

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

        socket.connect();
        socket.once("connect", () => setMySocketId(socket.id ?? null));
        socket.emit("join-room", { roomId, displayName });
        setJoined(true);
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

    function createPeerConnection(
      remoteSocketId: string,
      name: string
    ): RTCPeerConnection {
      const pc = new RTCPeerConnection({ iceServers });

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        setRemoteStreams((prev) => {
          const exists = prev.some((r) => r.socketId === remoteSocketId);
          if (exists) {
            return prev.map((r) =>
              r.socketId === remoteSocketId ? { ...r, stream } : r
            );
          }
          return [...prev, { socketId: remoteSocketId, name, stream }];
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

    async function callUser(remoteSocketId: string, name: string) {
      const pc = createPeerConnection(remoteSocketId, name);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { targetSocketId: remoteSocketId, offer });
    }

    function handleExistingUsers({ users, hostSocketId: hostId }: ExistingUsersPayload) {
      setHostSocketId(hostId);
      users.forEach(({ socketId, name }) => callUser(socketId, name));
    }

    function handleUserJoined({ socketId: _id, name: _name }: UserJoinedPayload) {
      // no-op; we wait for their offer since they're the new joiner.
      // Their name gets attached once their ontrack event fires with
      // this same socketId, via the peer connection created in handleOffer.
    }

    async function handleOffer({
      fromSocketId,
      offer,
    }: {
      fromSocketId: string;
      offer: RTCSessionDescriptionInit;
    }) {
      // We don't know their name yet from the offer alone; it was already
      // sent in "user-joined" just before this. Track it via a small map.
      const name = pendingNames.current.get(fromSocketId) || "Guest";
      const pc = createPeerConnection(fromSocketId, name);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
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
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }

    function handleUserLeft(remoteSocketId: string) {
      const pc = peerConnections.current.get(remoteSocketId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(remoteSocketId);
      }
      setRemoteStreams((prev) =>
        prev.filter((r) => r.socketId !== remoteSocketId)
      );
    }

    function handleHostChanged(newHostId: string) {
      setHostSocketId(newHostId);
    }

    // Track pending names for handleOffer (see note above).
    const pendingNames = { current: new Map<string, string>() };
    function trackName({ socketId, name }: UserJoinedPayload) {
      pendingNames.current.set(socketId, name);
    }

    socket.on("existing-users", handleExistingUsers);
    socket.on("user-joined", trackName);
    socket.on("user-joined", handleUserJoined);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("user-left", handleUserLeft);
    socket.on("host-changed", handleHostChanged);

    return () => {
      cancelled = true;
      socket.off("existing-users", handleExistingUsers);
      socket.off("user-joined", trackName);
      socket.off("user-joined", handleUserJoined);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("user-left", handleUserLeft);
      socket.off("host-changed", handleHostChanged);

      socket.emit("leave-room");
      socket.disconnect();

      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, displayName]);

  function toggleAudio() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioEnabled(audioTrack.enabled);
    }
  }

  function toggleVideo() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
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