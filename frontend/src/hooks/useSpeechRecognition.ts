import { useEffect, useRef, useState } from "react";

// The Web Speech API isn't in standard TS lib types yet, and it's prefixed
// in Chrome. This minimal typing covers just what we use.
interface SpeechRecognitionResult {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

/**
 * Live speech-to-text captions using the browser's built-in Web Speech API.
 * No backend calls needed — runs entirely client-side.
 *
 * Note: requires a secure context (https:// or localhost), same as camera
 * access, and is currently best-supported in Chrome/Edge.
 */
export function useSpeechRecognition(
  enabled: boolean,
  onSentenceCompleted?: (sentence: string) => void,
  onInterimSpeech?: (interim: string) => void
) {
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastProcessedIndexRef = useRef<number>(-1);

  useEffect(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setIsSupported(false);
      return;
    }

    if (!enabled) {
      setTranscript("");
      lastProcessedIndexRef.current = -1;
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Detect newly finalized segments and trigger callback
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal && i > lastProcessedIndexRef.current) {
          lastProcessedIndexRef.current = i;
          const completedText = event.results[i][0].transcript.trim();
          if (completedText && onSentenceCompleted) {
            onSentenceCompleted(completedText);
          }
        }
      }

      let combined = "";
      for (let i = 0; i < event.results.length; i++) {
        combined += event.results[i][0].transcript + " ";
      }
      const trimmed = combined.trim();
      setTranscript(trimmed);
      if (trimmed && onInterimSpeech) {
        onInterimSpeech(trimmed);
      }
    };

    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    recognition.onerror = (event: Event) => {
      console.warn("[speech recognition] error:", event);
    };

    // Some browsers stop recognition automatically after a period of
    // silence — restart it automatically to keep captions continuous.
    recognition.onend = () => {
      if (enabled) {
        const attemptStart = () => {
          try {
            lastProcessedIndexRef.current = -1; // Reset index for the new session
            recognition.start();
          } catch (err) {
            console.warn("[speech recognition] start failed, retrying in 1s...", err);
            retryTimeout = setTimeout(attemptStart, 1000);
          }
        };
        attemptStart();
      }
    };

    recognition.start();
    recognitionRef.current = recognition;

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      recognition.onend = null; // prevent auto-restart during cleanup
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [enabled]);

  return { transcript, isSupported };
}