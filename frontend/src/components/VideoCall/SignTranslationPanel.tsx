import { useRef, useState } from "react";
import type { MouseEvent } from "react";
import { HandIcon } from "./Icons";
import "./SignTranslationPanel.css";

interface SignTranslationPanelProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  result: { text: string; confidence: number; mode: string } | null;
  isLoading: boolean;
  loadError: string | null;
}

export function SignTranslationPanel({
  enabled,
  onToggle,
  result,
  isLoading,
  loadError,
}: SignTranslationPanelProps) {
  // Drag and resize position states
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 440, height: 160 });

  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const sizeStartRef = useRef<{ w: number; h: number; x: number; y: number } | null>(null);

  // Handle Dragging
  function handleMouseDown(e: MouseEvent) {
    if (
      (e.target as HTMLElement).closest(".sign-panel-controls") ||
      (e.target as HTMLElement).closest(".resize-handle") ||
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest("select")
    ) {
      return; // Ignore controls and handles
    }
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  function handleMouseMove(e: globalThis.MouseEvent) {
    if (!dragStartRef.current) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  }

  function handleMouseUp() {
    dragStartRef.current = null;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }

  // Handle Resizing
  function handleResizeMouseDown(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    sizeStartRef.current = {
      w: size.width,
      h: size.height,
      x: e.clientX,
      y: e.clientY,
    };
    document.addEventListener("mousemove", handleResizeMouseMove);
    document.addEventListener("mouseup", handleResizeMouseUp);
  }

  function handleResizeMouseMove(e: globalThis.MouseEvent) {
    if (!sizeStartRef.current) return;
    const deltaW = e.clientX - sizeStartRef.current.x;
    const deltaH = e.clientY - sizeStartRef.current.y;

    setSize({
      width: Math.max(340, sizeStartRef.current.w + deltaW),
      height: Math.max(120, sizeStartRef.current.h + deltaH),
    });
  }

  function handleResizeMouseUp() {
    sizeStartRef.current = null;
    document.removeEventListener("mousemove", handleResizeMouseMove);
    document.removeEventListener("mouseup", handleResizeMouseUp);
  }

  return (
    <div
      ref={panelRef}
      className={`sign-trans-panel-floating ${enabled ? "active" : ""}`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: `${size.width}px`,
        height: `${size.height}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="sign-trans-panel-header">
        <span className="drag-indicator">⋮⋮</span>
        <HandIcon size={16} className={`hand-indicator-icon ${enabled ? "pulse" : ""}`} />
        <span className="panel-title">Sign Language Translator</span>
        
        <button
          className={`sign-trans-toggle-btn ${enabled ? "enabled" : ""}`}
          onClick={() => onToggle(!enabled)}
        >
          {enabled ? "ON" : "OFF"}
        </button>
      </div>

      <div className="sign-trans-panel-controls">
      </div>

      <div className="sign-trans-panel-body">
        {loadError && <span className="sign-trans-error">{loadError}</span>}
        {!enabled && (
          <span className="sign-trans-placeholder">
            Toggle ON to translate camera signs into spoken words.
          </span>
        )}
        {enabled && isLoading && (
          <span className="sign-trans-loading">Analyzing frames...</span>
        )}
        {enabled && !isLoading && !result && (
          <span className="sign-trans-idle">
            Ready. Gesture clearly in front of the camera...
          </span>
        )}
        {enabled && !isLoading && result && result.text && (
          <div className="sign-trans-output-wrapper">
            <p className="sign-trans-text">{result.text}</p>
            <div className="sign-trans-meta">
              <span className="sign-trans-badge">MediaPipe</span>
              {result.confidence > 0 && (
                <span className="sign-trans-confidence">
                  {Math.round(result.confidence * 100)}% Match
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="resize-handle" onMouseDown={handleResizeMouseDown} />
    </div>
  );
}
