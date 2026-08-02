import { useEffect, useRef, useState } from "react";
import { GestureRecognizer } from "@mediapipe/tasks-vision";
import { getSharedGestureRecognizer } from "../lib/mediapipe";
import { gestureLabelToText } from "../lib/gestureMapping";
import { speechQueue } from "../lib/speechQueue";

interface TranslationResult {
  word: string;
  confidence: number;
  mode: "local";
}

export function useSignLanguageTranslation(
  stream: MediaStream | null,
  enabled: boolean,
  _mode: "local" | "cloud",
  _language: "ASL" | "BSL" | "ISL"
) {
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const lastSpokenRef = useRef<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastGestureRef = useRef<string | null>(null);
  const gestureHistoryRef = useRef<string[]>([]);
  const lastCheckRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // Load MediaPipe locally via shared singleton
  useEffect(() => {
    let cancelled = false;

    async function loadMediaPipe() {
      try {
        setIsLoading(true);
        const recognizer = await getSharedGestureRecognizer();
        if (!cancelled) {
          recognizerRef.current = recognizer;
          setIsLoading(false);
          setModelReady(true);
        }
      } catch (err) {
        console.warn("[MediaPipe Load Warning] Could not load local recognizer:", err);
        setIsLoading(false);
      }
    }

    loadMediaPipe();

    return () => {
      cancelled = true;
      recognizerRef.current = null; // Do not call close() as it's a shared instance
    };
  }, []);

  // Local sign-to-speech loop using MediaPipe only. This stays lightweight and avoids any external API dependency.
  useEffect(() => {
    if (!enabled || !stream || !modelReady || !recognizerRef.current) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      gestureHistoryRef.current = [];
      lastGestureRef.current = null;
      return;
    }

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    videoRef.current = video;
    video.play().catch(() => {});

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
              console.warn("[translation loop] Stalled readyState recovery triggered");
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

      if (nowMs - lastCheckRef.current >= 180) {
        lastCheckRef.current = nowMs;
        const results = recognizer.recognizeForVideo(videoEl, nowMs);
        const topGesture = results.gestures?.[0]?.[0];
        const detectedCategory = topGesture && topGesture.score >= 0.6 ? topGesture.categoryName : "none";

        gestureHistoryRef.current.push(detectedCategory);
        if (gestureHistoryRef.current.length > 8) {
          gestureHistoryRef.current.shift();
        }

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
        if (majorityGesture !== "none" && maxCount >= 5) {
          if (majorityGesture !== lastGestureRef.current) {
            lastGestureRef.current = majorityGesture;
            const word = gestureLabelToText(majorityGesture);
            if (word) {
              handleNewTranslation({
                word,
                confidence: Math.max(0.7, Math.min(0.98, topGesture?.score ?? 0.7)),
                mode: "local",
              });
            }
          } else {
            // Same gesture is held: refresh clean/clear timer
            if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
            clearTimerRef.current = setTimeout(() => {
              setResult(null);
              lastSpokenRef.current = null;
              lastGestureRef.current = null;
              gestureHistoryRef.current = [];
            }, 3000);
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
      lastGestureRef.current = null;
      gestureHistoryRef.current = [];
    };
  }, [enabled, stream, modelReady]);

  // Handle SpeechSynthesis (TTS) via central queue and UI auto-clearing
  function handleNewTranslation(res: TranslationResult) {
    setResult(res);

    // Speak it out loud via unified speechQueue if it's new.
    if (res.word && res.word !== lastSpokenRef.current) {
      lastSpokenRef.current = res.word;
      speechQueue.enqueue({
        id: `translation-${res.word}-${Date.now()}`,
        text: res.word,
      });
    }

    // Clear after 3 seconds of inactivity.
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      setResult(null);
      lastSpokenRef.current = null;
      lastGestureRef.current = null;
      gestureHistoryRef.current = [];
    }, 3000);
  }

  // Cancel speech synthesis immediately if the panel is disabled or hook unmounts
  useEffect(() => {
    if (!enabled) {
      speechQueue.cancelAll();
      lastSpokenRef.current = null;
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      speechQueue.cancelAll();
    };
  }, []);

  return { result, isLoading, loadError };
}
