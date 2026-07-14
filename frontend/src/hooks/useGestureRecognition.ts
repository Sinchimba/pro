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
      const results = recognizer.recognizeForVideo(videoEl, nowMs);

      const topGesture = results.gestures?.[0]?.[0];
      if (topGesture && topGesture.score >= MIN_CONFIDENCE) {
        const category = topGesture.categoryName;
        if (category !== lastGestureRef.current) {
          lastGestureRef.current = category;
          const text = gestureLabelToText(category);
          if (text) {
            setResult({ gesture: category, text });
            if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
            clearTimerRef.current = setTimeout(() => {
              setResult(null);
              lastGestureRef.current = null;
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