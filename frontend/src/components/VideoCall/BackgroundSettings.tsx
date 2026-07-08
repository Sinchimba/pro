import "./BackgroundSettings.css";

export type BackgroundEffect = "none" | "blur-soft" | "blur-deep" | "bg-office" | "bg-beach";

interface BackgroundSettingsProps {
  currentEffect: BackgroundEffect;
  onChangeEffect: (effect: BackgroundEffect) => void;
  onClose: () => void;
}

export function BackgroundSettings({
  currentEffect,
  onChangeEffect,
  onClose,
}: BackgroundSettingsProps) {
  const options: { id: BackgroundEffect; label: string; desc: string; preview: string }[] = [
    { id: "none", label: "No effect", desc: "Standard camera feed", preview: "📷" },
    { id: "blur-soft", label: "Soft Blur", desc: "Slightly blur background", preview: "░" },
    { id: "blur-deep", label: "Deep Blur", desc: "Strongly blur background", preview: "▒" },
    { id: "bg-office", label: "Office", desc: "Professional office background", preview: "💼" },
    { id: "bg-beach", label: "Beach", desc: "Sunny beach background", preview: "🏖️" },
  ];

  return (
    <div className="background-settings-panel">
      <div className="bg-settings-header">
        Visual Effects
        <button onClick={onClose} aria-label="Close settings">
          ×
        </button>
      </div>

      <div className="bg-settings-body">
        <p className="bg-settings-intro">
          Choose a background effect to apply to your camera feed.
        </p>

        <div className="bg-options-grid">
          {options.map((opt) => (
            <button
              key={opt.id}
              className={`bg-option-card ${currentEffect === opt.id ? "active" : ""}`}
              onClick={() => onChangeEffect(opt.id)}
            >
              <div className="bg-option-preview">{opt.preview}</div>
              <div className="bg-option-info">
                <span className="bg-option-label">{opt.label}</span>
                <span className="bg-option-desc">{opt.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
