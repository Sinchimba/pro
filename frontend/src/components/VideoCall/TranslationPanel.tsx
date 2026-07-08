import { useEffect, useState, useRef } from "react";
import type { MouseEvent } from "react";
import "./TranslationPanel.css";

interface TranslationPanelProps {
  transcript: string;
}

const LANGUAGES = [
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "ar", name: "Arabic" },
  { code: "ja", name: "Japanese" },
  { code: "hi", name: "Hindi" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "sw", name: "Swahili" },
];

export function TranslationPanel({ transcript }: TranslationPanelProps) {
  const [targetLang, setTargetLang] = useState("es");
  const [translatedText, setTranslatedText] = useState("");
  const [loading, setLoading] = useState(false);

  // Position state (starts floating near bottom center)
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 420, height: 130 });
  
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const sizeStartRef = useRef<{ w: number; h: number; x: number; y: number } | null>(null);

  // Debounce API calls to avoid spamming the free Google Translate API
  useEffect(() => {
    if (!transcript.trim()) {
      setTranslatedText("");
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(transcript)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Translation API failed");
        
        const data = await response.json();
        if (data && data[0]) {
          const result = data[0].map((item: any) => item[0]).join("");
          setTranslatedText(result);
        }
      } catch (error) {
        console.error("Translation error:", error);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [transcript, targetLang]);

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
        <span className="panel-title">Real-time Translation</span>
        
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="translation-dropdown"
          onMouseDown={(e) => e.stopPropagation()} // Prevent dragging when clicking dropdown
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="translation-panel-body">
        {loading && <span className="translation-loading-indicator">Translating...</span>}
        {!transcript.trim() && (
          <span className="translation-placeholder">
            Speak to see live translation here...
          </span>
        )}
        {translatedText && (
          <p className="translation-text">{translatedText}</p>
        )}
      </div>

      <div className="resize-handle" onMouseDown={handleResizeMouseDown} />
    </div>
  );
}
