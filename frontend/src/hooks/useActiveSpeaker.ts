import { useEffect, useRef, useState } from "react";
import type { RemoteStream } from "../types";

const SPEAKING_THRESHOLD = 12; // 0-255 scale from AnalyserNode
const CHECK_INTERVAL_MS = 200;

interface AnalyserEntry {
  analyser: AnalyserNode;
  dataArray: Uint8Array;
}

/**
 * Measures audio volume for the local stream and every remote stream to
 * determine who's currently speaking. Returns "local" for yourself, a
 * socketId for a remote participant, or null if nobody's talking loudly
 * enough to count.
 */
export function useActiveSpeaker(
  localStream: MediaStream | null,
  remoteStreams: RemoteStream[]
) {
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, AnalyserEntry>>(new Map());

  useEffect(() => {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    audioContextRef.current = audioContext;

    function attach(id: string, stream: MediaStream) {
      if (stream.getAudioTracks().length === 0) return;
      try {
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analysersRef.current.set(id, {
          analyser,
          dataArray: new Uint8Array(analyser.frequencyBinCount),
        });
      } catch (err) {
        console.warn("[active speaker] could not analyze stream:", id, err);
      }
    }

    if (localStream) attach("local", localStream);
    remoteStreams.forEach((r) => attach(r.socketId, r.stream));

    const interval = setInterval(() => {
      let loudestId: string | null = null;
      let loudestVolume = SPEAKING_THRESHOLD;

      analysersRef.current.forEach(({ analyser, dataArray }, id) => {
        analyser.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>);
        const average =
          dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
        if (average > loudestVolume) {
          loudestVolume = average;
          loudestId = id;
        }
      });

      setActiveSpeakerId(loudestId);
    }, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      analysersRef.current.clear();
      audioContext.close().catch(() => {});
    };
    // Re-run when the set of streams changes (new/removed participants).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, remoteStreams.map((r) => r.socketId).join(",")]);

  return activeSpeakerId;
}