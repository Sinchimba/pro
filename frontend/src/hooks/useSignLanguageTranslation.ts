import { useEffect, useRef, useState } from "react";
import { GestureRecognizer } from "@mediapipe/tasks-vision";
import { getSharedGestureRecognizer } from "../lib/mediapipe";
import { gestureLabelToText } from "../lib/gestureMapping";

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
  const [isLoading] = useState(false);
  const [loadError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const lastSpokenRef = useRef<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastGestureRef = useRef<string | null>(null);
  const gestureHistoryRef = useRef<string[]>([]);
  const lastCheckRef = useRef<number>(0);

  // Load MediaPipe locally via shared singleton
  useEffect(() => {
    let cancelled = false;

    async function loadMediaPipe() {
      try {
        const recognizer = await getSharedGestureRecognizer();
        if (!cancelled) {
          recognizerRef.current = recognizer;
        }
      } catch (err) {
        console.warn("[MediaPipe Load Warning] Could not load local recognizer:", err);
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
    if (!enabled || !stream) {
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
      if (!recognizer || !videoEl || videoEl.readyState < 2) {
        rafRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      const nowMs = performance.now();
      if (nowMs - lastCheckRef.current >= 180) {
        lastCheckRef.current = nowMs;
        const results = recognizer.recognizeForVideo(videoEl, nowMs);
        const topGesture = results.gestures?.[0]?.[0];
        const detectedCategory = topGesture && topGesture.score >= 0.6 ? topGesture.categoryName : "none";

        gestureHistoryRef.current.push(detectedCategory);
        if (gestureHistoryRef.current.length > 4) {
          gestureHistoryRef.current.shift();
        }

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

        if (majorityGesture !== "none" && majorityGesture !== lastGestureRef.current) {
          const word = gestureLabelToText(majorityGesture);
          if (word) {
            lastGestureRef.current = majorityGesture;
            handleNewTranslation({
              word,
              confidence: Math.max(0.7, Math.min(0.98, topGesture?.score ?? 0.7)),
              mode: "local",
            });
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
  }, [enabled, stream]);

  // Handle SpeechSynthesis (TTS) and UI auto-clearing
  function handleNewTranslation(res: TranslationResult) {
    setResult(res);

    // Speak it out loud if it's new.
    if (res.word && res.word !== lastSpokenRef.current) {
      lastSpokenRef.current = res.word;
      const utterance = new SpeechSynthesisUtterance(res.word);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
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
      window.speechSynthesis.cancel();
      lastSpokenRef.current = null;
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  return { result, isLoading, loadError };
}
