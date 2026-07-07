import { useEffect, useRef, useState } from "react";
import {
  GestureRecognizer,
  FilesetResolver,
} from "@mediapipe/tasks-vision";
import { gestureLabelToText } from "../lib/gestureMapping";

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

  // Load the model once.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        // Loaded from Google's public CDN at runtime — requires the
        // browser to have normal internet access (not blocked by any
        // local firewall/proxy).
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
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
      recognizerRef.current?.close();
      recognizerRef.current = null;
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