import { useEffect, useRef, useState } from "react";
import { GestureRecognizer, FilesetResolver } from "@mediapipe/tasks-vision";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpokenRef = useRef<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load MediaPipe locally (only when local mode is selected or for fallback)
  useEffect(() => {
    let cancelled = false;

    async function loadMediaPipe() {
      try {
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
        }
      } catch (err) {
        console.warn("[MediaPipe Load Warning] Could not load local recognizer:", err);
      }
    }

    loadMediaPipe();

    return () => {
      cancelled = true;
      recognizerRef.current?.close();
      recognizerRef.current = null;
    };
  }, []);

  // Frame Capture & API Translation Loop
  useEffect(() => {
    if (!enabled || !stream) {
      if (intervalRef.current) clearInterval(intervalRef.current);
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

          if (topGesture && topGesture.score >= 0.6) {
            const category = topGesture.categoryName;
            // Map simple gesture names to readable words
            let mappedWord = category;
            if (category === "Thumb_Up") mappedWord = "Yes";
            if (category === "Thumb_Down") mappedWord = "No";
            if (category === "Closed_Fist") mappedWord = "Wait";
            if (category === "Open_Palm") mappedWord = "Stop";
            if (category === "Pointing_Up") mappedWord = "Look";
            if (category === "Victory") mappedWord = "Peace";
            if (category === "ILoveYou") mappedWord = "I Love You";

            handleNewTranslation({
              word: mappedWord,
              confidence: topGesture.score,
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

    // Run frame capturing loop every 1.3 seconds
    intervalRef.current = setInterval(processFrame, 1300);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
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
