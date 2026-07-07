import { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";
import { iceServers } from "../lib/iceServers";
import type { RemoteStream } from "../types";

/**
 * Handles the full WebRTC lifecycle for a room:
 * - grabs local camera/mic
 * - connects to the signaling server and joins the room
 * - creates a peer connection per remote participant (mesh topology)
 * - exchanges offer/answer/ICE candidates via the backend
 * - exposes local + remote streams for the UI to render
 */
export function useWebRTC(roomId: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [joined, setJoined] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

   async function start() {
      try {
        // getUserMedia requires a "secure context" — https, or localhost.
        // Accessing the app via a plain http://<lan-ip> address (e.g. from
        // a phone) is NOT considered secure by the browser, so this call
        // can fail here even though everything else about the setup is fine.
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
        setLocalStream(stream);

        socket.connect();
        socket.emit("join-room", roomId);
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

    function createPeerConnection(remoteSocketId: string): RTCPeerConnection {
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
          return [...prev, { socketId: remoteSocketId, stream }];
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

    async function callUser(remoteSocketId: string) {
      const pc = createPeerConnection(remoteSocketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { targetSocketId: remoteSocketId, offer });
    }

    function handleExistingUsers(existingUsers: string[]) {
      existingUsers.forEach((id) => callUser(id));
    }

    function handleUserJoined(_newSocketId: string) {
      // no-op; existing peers wait for the new joiner's offer
    }

    async function handleOffer({
      fromSocketId,
      offer,
    }: {
      fromSocketId: string;
      offer: RTCSessionDescriptionInit;
    }) {
      const pc = createPeerConnection(fromSocketId);
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

    socket.on("existing-users", handleExistingUsers);
    socket.on("user-joined", handleUserJoined);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("user-left", handleUserLeft);

    return () => {
      cancelled = true;
      socket.off("existing-users", handleExistingUsers);
      socket.off("user-joined", handleUserJoined);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("user-left", handleUserLeft);

      socket.emit("leave-room");
      socket.disconnect();

      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

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

  return {
    localStream,
    remoteStreams,
    joined,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    error,
  };
}
