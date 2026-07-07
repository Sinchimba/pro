import { useEffect, useRef } from "react";
import { HandIcon } from "../icons";
import "./RecognitionPanel.css";

interface RecognitionPanelProps {
  result: { gesture: string; text: string } | null;
  isLoading: boolean;
  loadError: string | null;
}

export function RecognitionPanel({
  result,
  isLoading,
  loadError,
}: RecognitionPanelProps) {
  const lastSpokenRef = useRef<string | null>(null);

  // Speak newly recognized text via the browser's built-in TTS, so a
  // hearing participant "hears" what was signed.
  useEffect(() => {
    if (result && result.text !== lastSpokenRef.current) {
      lastSpokenRef.current = result.text;
      const utterance = new SpeechSynthesisUtterance(result.text);
      window.speechSynthesis.speak(utterance);
    }
  }, [result]);

  return (
    <div className="recognition-panel">
      <div className="recognition-panel-header">
        <HandIcon size={13} />
        Sign recognition
      </div>
      <div className="recognition-panel-body">
        {loadError && <div className="recognition-idle">{loadError}</div>}

        {!loadError && isLoading && (
          <div className="recognition-loading">Loading model…</div>
        )}

        {!loadError && !isLoading && !result && (
          <div className="recognition-idle">
            Show a hand sign to the camera to translate it.
          </div>
        )}

        {!loadError && !isLoading && result && (
          <div className="recognition-result">{result.text}</div>
        )}
      </div>
    </div>
  );
}