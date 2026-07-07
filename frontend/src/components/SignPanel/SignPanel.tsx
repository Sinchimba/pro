import { useEffect, useState } from "react";
import { HandIcon } from "../icons";
import type { SignEntry } from "../../lib/signVocabulary";
import "./SignPanel.css";

interface SignPanelProps {
  activeSign: SignEntry | null;
}

export function SignPanel({ activeSign }: SignPanelProps) {
  const [clipMissing, setClipMissing] = useState(false);

  // Reset the "missing" flag whenever the word changes, so a previous
  // word's missing clip doesn't wrongly mark a new word's clip as missing.
  useEffect(() => {
    setClipMissing(false);
  }, [activeSign?.word]);

  return (
    <div className="sign-panel">
      <div className="sign-panel-header">
        <HandIcon size={13} />
        Sign translation
      </div>
      <div className="sign-panel-body">
        {!activeSign && (
          <div className="sign-panel-idle">
            Sign translation will appear here when a recognized word is
            spoken.
          </div>
        )}

        {activeSign && !clipMissing && (
          <video
            key={activeSign.word}
            className="sign-panel-video"
            src={activeSign.videoUrl}
            autoPlay
            muted
            playsInline
            onError={() => setClipMissing(true)}
          />
        )}

        {activeSign && clipMissing && (
          <div className="sign-panel-placeholder">
            <HandIcon size={28} />
            <span className="sign-panel-word">{activeSign.word}</span>
            <span className="sign-panel-hint">
              Clip not found — add <code>{activeSign.videoUrl.split("/").pop()}</code> to{" "}
              <code>public/sign-clips/</code>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}