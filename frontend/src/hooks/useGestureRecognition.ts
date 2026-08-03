import { useEffect, useRef, useState } from "react";
import { GestureRecognizer } from "@mediapipe/tasks-vision";
import { gestureLabelToText } from "../lib/gestureMapping";
import { getSharedGestureRecognizer } from "../lib/mediapipe";

const MIN_CONFIDENCE = 0.6;
const HOLD_MS = 2500;

interface GestureResult {
  gesture: string; // e.g. "Thumb_Up"
  text: string; // mapped vocabulary text, e.g. "yes"
  confidence: number;
}

/**
 * Runs MediaPipe's pretrained Gesture Recognizer on a live video stream,
 * entirely in the browser (no backend calls). Returns the most recently
 * recognized gesture, mapped to text, held for a short time so the UI
 * doesn't flicker between frames.
 */
export function useGestureRecognition(
  stream: MediaStream | null,
  enabled: boolean
) {
  const [result, setResult] = useState<GestureResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastGestureRef = useRef<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Ref for tracking inference frequency and temporal history window
  const lastCheckRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const gestureHistoryRef = useRef<string[]>([]);

  // Load the model once via shared singleton.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        const recognizer = await getSharedGestureRecognizer();
        if (!cancelled) {
          recognizerRef.current = recognizer;
          setIsLoading(false);
          setModelReady(true);
        }
      } catch (err) {
        console.error("[gesture recognition] failed to load model:", err);
        if (!cancelled) {
          setLoadError(
            "Couldn't load the sign recognition model. Check your internet connection."
          );
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      recognizerRef.current = null; // Do not call close() as it's a shared instance
    };
  }, []);

  // Run recognition on the stream once both the model and stream are ready.
  useEffect(() => {
    if (!enabled || !stream || !modelReady || !recognizerRef.current) return;

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    videoRef.current = video;
    video.play().catch(() => {
      // Autoplay can be blocked in some contexts; recognition simply
      // won't produce results until the stream is actually playing.
    });

    function detectLoop() {
      const recognizer = recognizerRef.current;
      const videoEl = videoRef.current;
      const nowMs = performance.now();

      // Check if video is paused but the stream has active and enabled tracks
      if (videoEl && videoEl.paused && videoEl.srcObject) {
        const activeStream = videoEl.srcObject as MediaStream;
        const videoTrack = activeStream.getVideoTracks()[0];
        if (videoTrack && videoTrack.readyState === "live" && videoTrack.enabled) {
          videoEl.play().catch(() => {});
        }
      }

      if (!recognizer || !videoEl || videoEl.readyState < 2) {
        // Stalled video element recovery: if we are live and enabled but readyState is stuck
        // under 2 for over 3 seconds, reset the stream source to trigger auto-recovery.
        if (videoEl && !videoEl.paused && videoEl.srcObject) {
          const activeStream = videoEl.srcObject as MediaStream;
          const videoTrack = activeStream.getVideoTracks()[0];
          if (videoTrack && videoTrack.readyState === "live" && videoTrack.enabled) {
            if (!lastFrameTimeRef.current) {
              lastFrameTimeRef.current = nowMs;
            }
            if (nowMs - lastFrameTimeRef.current > 3000) {
              console.warn("[gesture recognition] Stalled readyState recovery triggered");
              videoEl.srcObject = null;
              videoEl.srcObject = activeStream;
              videoEl.play().catch(() => {});
              lastFrameTimeRef.current = nowMs;
            }
          }
        }
        rafRef.current = requestAnimationFrame(detectLoop);
        return;
      }
      lastFrameTimeRef.current = nowMs;

      // Throttle the MediaPipe recognition pipeline to 10 FPS (every 100ms) to drastically save CPU/battery
      if (nowMs - lastCheckRef.current >= 100) {
        lastCheckRef.current = nowMs;
        const results = recognizer.recognizeForVideo(videoEl, nowMs);

        const topGesture = results.gestures?.[0]?.[0];
        const detectedCategory = (topGesture && topGesture.score >= MIN_CONFIDENCE) ? topGesture.categoryName : "none";

        // Smooth output: push current prediction to rolling temporal history (8 frames)
        gestureHistoryRef.current.push(detectedCategory);
        if (gestureHistoryRef.current.length > 8) {
          gestureHistoryRef.current.shift();
        }

        // Apply majority voting over the window
        const counts: Record<string, number> = {};
        for (const g of gestureHistoryRef.current) {
          counts[g] = (counts[g] || 0) + 1;
        }

        let majorityGesture = "none";
        let maxCount = 0;
        for (const [g, count] of Object.entries(counts)) {
          if (count > maxCount) {
            maxCount = count;
            majorityGesture = g;
          }
        }

        // Require at least 5 frames of consensus in our 8-frame window (62.5% consensus) to trigger.
        // This ignores temporary frame losses (e.g. 1-3 frames of "none") and noisy transient predictions.
        if (majorityGesture !== "none" && maxCount >= 5) {
          if (majorityGesture !== lastGestureRef.current) {
            lastGestureRef.current = majorityGesture;
            const text = gestureLabelToText(majorityGesture);
            if (text) {
              const confidence = topGesture && typeof topGesture.score === "number" ? topGesture.score : 0.8;
              setResult({ gesture: majorityGesture, text, confidence });
            }
          }
          // Refresh the hold timer while the same gesture (or a new stable one) continues to be held
          if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
          clearTimerRef.current = setTimeout(() => {
            setResult(null);
            lastGestureRef.current = null;
            gestureHistoryRef.current = [];
          }, HOLD_MS);
        }
      }

      rafRef.current = requestAnimationFrame(detectLoop);
    }

    detectLoop();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      video.pause();
      video.srcObject = null;
    };
  }, [enabled, stream, modelReady]);

  return { result, isLoading, loadError };
}