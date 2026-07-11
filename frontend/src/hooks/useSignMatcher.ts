import { useEffect, useRef, useState } from "react";
import { matchSignWord } from "../lib/signVocabulary";
import type { SignEntry } from "../lib/signVocabulary";

export interface TranscriptAction {
  text: string;
  timestamp: number;
  senderId: string;
}

/**
 * Watches the live caption transcript actions and surfaces a matched sign-vocabulary
 * word. Uses action timestamps to guarantee that repeated words, overlapping speech,
 * or concurrent participant inputs trigger translation events in real-time.
 */
export function useSignMatcher(action: TranscriptAction | null, holdMs = 3000) {
  const [activeSign, setActiveSign] = useState<SignEntry | null>(null);
  const lastActionTimestampRef = useRef<number>(0);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!action || !action.text) return;

    const match = matchSignWord(action.text);
    if (match) {
      // Trigger translation if this is a new speech event (different timestamp)
      if (action.timestamp !== lastActionTimestampRef.current) {
        lastActionTimestampRef.current = action.timestamp;
        
        // Temporarily clear active sign to force a video reload/replay in the UI if it's the same word
        setActiveSign(null);
        
        // Use a microtask/setTimeout delay to let the react state transition complete
        const triggerTimer = setTimeout(() => {
          setActiveSign(match);
        }, 50);

        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        clearTimerRef.current = setTimeout(() => {
          setActiveSign(null);
        }, holdMs);

        return () => clearTimeout(triggerTimer);
      }
    }
  }, [action, holdMs]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  return activeSign;
}