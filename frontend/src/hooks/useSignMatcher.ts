import { useEffect, useRef, useState } from "react";
import { matchSignWord } from "../lib/signVocabulary";
import type { SignEntry } from "../lib/signVocabulary";

/**
 * Watches the live caption transcript and surfaces a matched sign-vocabulary
 * word. Keeps the match visible for a short time after it's found so the
 * sign clip has time to actually play, instead of flickering with every
 * partial transcript update.
 */
export function useSignMatcher(transcript: string, holdMs = 3000) {
  const [activeSign, setActiveSign] = useState<SignEntry | null>(null);
  const lastMatchedWordRef = useRef<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!transcript) return;

    const match = matchSignWord(transcript);
    if (match && match.word !== lastMatchedWordRef.current) {
      lastMatchedWordRef.current = match.word;
      setActiveSign(match);

      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => {
        setActiveSign(null);
        lastMatchedWordRef.current = null;
      }, holdMs);
    }
  }, [transcript, holdMs]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  return activeSign;
}