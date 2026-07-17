import { useEffect, useRef, useState } from "react";
import { GestureRecognizer } from "@mediapipe/tasks-vision";
import { getSharedGestureRecognizer } from "../lib/mediapipe";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (import.meta.env.PROD ? "" : "http://localhost:4000");

interface TranslationResult {
  word: string;
  confidence: number;
  mode: "local" | "cloud" | "simulation" | "idle";
}

export function useSignLanguageTranslation(
  stream: MediaStream | null,
  enabled: boolean,
  mode: "local" | "cloud",
  language: "ASL" | "BSL" | "ISL"
) {
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const lastSpokenRef = useRef<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevImageDataRef = useRef<Uint8ClampedArray | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureHistoryRef = useRef<string[]>([]);

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

  // Frame Capture & API Translation Loop
  useEffect(() => {
    if (!enabled || !stream) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      prevImageDataRef.current = null;
      gestureHistoryRef.current = [];
      return;
    }

    // Set up offscreen video for frame capturing
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    videoRef.current = video;
    video.play().catch(() => {});

    // Set up offscreen canvas for frame resizing (640x480 for better finger/detail visibility in Gemini Vision)
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    canvasRef.current = canvas;

    async function processFrame() {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Draw and resize the video frame onto the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Motion detection by temporal frame-differencing to optimize efficiency
      let motionDetected = false;
      if (prevImageDataRef.current) {
        let diffPixels = 0;
        const totalSampledPixels = data.length / 16; // sampling every 4th pixel to save CPU
        for (let i = 0; i < data.length; i += 16) {
          const rDiff = Math.abs(data[i] - prevImageDataRef.current[i]);
          const gDiff = Math.abs(data[i + 1] - prevImageDataRef.current[i + 1]);
          const bDiff = Math.abs(data[i + 2] - prevImageDataRef.current[i + 2]);
          if (rDiff + gDiff + bDiff > 35) { // Color difference threshold
            diffPixels++;
          }
        }
        
        const motionRatio = diffPixels / totalSampledPixels;
        // If more than 1.5% of pixels changed, we consider it active motion (e.g. hand movements)
        motionDetected = motionRatio > 0.015;
      } else {
        // First frame always counts as motion to initialize state
        motionDetected = true;
      }
      
      prevImageDataRef.current = data;

      // If no motion is detected, we skip recognition processing to save battery and network bandwidth
      if (!motionDetected) {
        return;
      }

      if (mode === "local") {
        // --- LOCAL CLASSIFICATION (MediaPipe) ---
        const recognizer = recognizerRef.current;
        if (!recognizer) {
          setLoadError("Local MediaPipe model is not loaded yet.");
          return;
        }
        try {
          const nowMs = performance.now();
          const results = recognizer.recognizeForVideo(video, nowMs);
          const topGesture = results.gestures?.[0]?.[0];
          const detectedCategory = (topGesture && topGesture.score >= 0.6) ? topGesture.categoryName : "none";

          // Rolling temporal history smoothing
          gestureHistoryRef.current.push(detectedCategory);
          if (gestureHistoryRef.current.length > 5) {
            gestureHistoryRef.current.shift();
          }

          // Majority voting
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

          if (majorityGesture !== "none") {
            // Map simple gesture names to readable words
            let mappedWord = majorityGesture;
            if (majorityGesture === "Thumb_Up") mappedWord = "Yes";
            if (majorityGesture === "Thumb_Down") mappedWord = "No";
            if (majorityGesture === "Closed_Fist") mappedWord = "Wait";
            if (majorityGesture === "Open_Palm") mappedWord = "Stop";
            if (majorityGesture === "Pointing_Up") mappedWord = "Look";
            if (majorityGesture === "Victory") mappedWord = "Peace";
            if (majorityGesture === "ILoveYou") mappedWord = "I Love You";

            handleNewTranslation({
              word: mappedWord,
              confidence: 0.8,
              mode: "local",
            });
          }
        } catch (err) {
          console.error("Local MediaPipe processing failed:", err);
        }
      } else {
        // --- CLOUD CLASSIFICATION (Gemini API Proxy) ---
        setIsLoading(true);
        try {
          const base64Image = canvas.toDataURL("image/jpeg", 0.7);
          const response = await fetch(`${BACKEND_URL}/api/translate-sign`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              image: base64Image,
              language,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = (await response.json()) as TranslationResult;
          if (data.word) {
            handleNewTranslation(data);
          }
        } catch (err) {
          console.error("Cloud Gemini translation failed:", err);
        } finally {
          setIsLoading(false);
        }
      }
    }

    // Adaptive recursive setTimeout loop for ultra-fast, non-overlapping updates
    async function runLoop() {
      if (!enabled || !stream) return;
      await processFrame();
      const delay = mode === "local" ? 300 : 800; // 300ms for local MediaPipe (fast), 800ms for cloud Gemini
      timeoutRef.current = setTimeout(runLoop, delay);
    }

    runLoop();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      prevImageDataRef.current = null;
      video.pause();
      video.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, stream, mode, language]);

  // Handle SpeechSynthesis (TTS) and UI auto-clearing
  function handleNewTranslation(res: TranslationResult) {
    setResult(res);

    // Speak it out loud if it's new
    if (res.word && res.word !== lastSpokenRef.current) {
      lastSpokenRef.current = res.word;
      const utterance = new SpeechSynthesisUtterance(res.word);
      // Try to select an English voice matching regional accents
      const voices = window.speechSynthesis.getVoices();
      if (language === "BSL") {
        const ukVoice = voices.find((v) => v.lang.startsWith("en-GB"));
        if (ukVoice) utterance.voice = ukVoice;
      } else if (language === "ISL") {
        const inVoice = voices.find((v) => v.lang.startsWith("en-IN"));
        if (inVoice) utterance.voice = inVoice;
      }
      window.speechSynthesis.speak(utterance);
    }

    // Clear after 3 seconds of inactivity
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      setResult(null);
      lastSpokenRef.current = null;
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
