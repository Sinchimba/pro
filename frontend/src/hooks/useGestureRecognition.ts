import { useEffect, useRef, useState } from "react";
import { GestureRecognizer } from "@mediapipe/tasks-vision";
import { gestureLabelToText } from "../lib/gestureMapping";
import { getSharedGestureRecognizer } from "../lib/mediapipe";

const MIN_CONFIDENCE = 0.6;
const HOLD_MS = 2500;

interface GestureResult {
  gesture: string; // e.g. "Thumb_Up"
  text: string; // mapped vocabulary text, e.g. "yes"
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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastGestureRef = useRef<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Ref for tracking inference frequency and temporal history window
  const lastCheckRef = useRef<number>(0);
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
    if (!enabled || !stream || !recognizerRef.current) return;

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
      if (!recognizer || !videoEl || videoEl.readyState < 2) {
        rafRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      const nowMs = performance.now();
      // Throttle the MediaPipe recognition pipeline to 10 FPS (every 100ms) to drastically save CPU/battery
      if (nowMs - lastCheckRef.current >= 100) {
        lastCheckRef.current = nowMs;
        const results = recognizer.recognizeForVideo(videoEl, nowMs);

        const topGesture = results.gestures?.[0]?.[0];
        const detectedCategory = (topGesture && topGesture.score >= MIN_CONFIDENCE) ? topGesture.categoryName : "none";

        // Smooth output: push current prediction to rolling temporal history (5 frames)
        gestureHistoryRef.current.push(detectedCategory);
        if (gestureHistoryRef.current.length > 5) {
          gestureHistoryRef.current.shift();
        }

        // Apply majority voting over the window
        const counts: Record<string, number> = {};
        let maxCount = 0;
        let majorityGesture = "none";
        for (const g of gestureHistoryRef.current) {
          counts[g] = (counts[g] || 0) + 1;
          if (counts[g] > maxCount) {
            maxCount = counts[g];
            majorityGesture = g;
          }
        }

        // If we get a stable new gesture that isn't idle/none
        if (majorityGesture !== "none" && majorityGesture !== lastGestureRef.current) {
          lastGestureRef.current = majorityGesture;
          const text = gestureLabelToText(majorityGesture);
          if (text) {
            setResult({ gesture: majorityGesture, text });
            if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
            clearTimerRef.current = setTimeout(() => {
              setResult(null);
              lastGestureRef.current = null;
              gestureHistoryRef.current = [];
            }, HOLD_MS);
          }
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
  }, [enabled, stream]);

  return { result, isLoading, loadError };
}