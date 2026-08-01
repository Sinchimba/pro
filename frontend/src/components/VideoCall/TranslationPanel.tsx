import { useState, useRef } from "react";
import type { MouseEvent } from "react";
import "./TranslationPanel.css";

interface TranslationPanelProps {
  transcript: string;
}

export function TranslationPanel({ transcript }: TranslationPanelProps) {

  // Position state (starts floating near bottom center)
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 420, height: 130 });
  
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const sizeStartRef = useRef<{ w: number; h: number; x: number; y: number } | null>(null);

  // Handle Dragging
  function handleMouseDown(e: MouseEvent) {
    if ((e.target as HTMLElement).closest(".translation-dropdown") || (e.target as HTMLElement).closest(".resize-handle")) {
      return; // Ignore dropdown and resize clicks
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
      width: Math.max(300, sizeStartRef.current.w + deltaW),
      height: Math.max(90, sizeStartRef.current.h + deltaH),
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
      className="translation-panel-floating"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: `${size.width}px`,
        height: `${size.height}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="translation-panel-header">
        <span className="drag-indicator">⋮⋮</span>
        <span className="panel-title">Live Transcript</span>
      </div>

      <div className="translation-panel-body">
        {!transcript.trim() && (
          <span className="translation-placeholder">
            Speak to see live captions here...
          </span>
        )}
        {transcript.trim() && (
          <p className="translation-text">{transcript.trim()}</p>
        )}
      </div>

      <div className="resize-handle" onMouseDown={handleResizeMouseDown} />
    </div>
  );
}
