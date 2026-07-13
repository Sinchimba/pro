interface IconProps {
  size?: number;
}

export function VideoIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2" y="6" width="14" height="12" rx="2.5" />
      <path d="M16 10.5l6-3.2v9.4l-6-3.2" strokeLinejoin="round" />
    </svg>
  );
}

export function HandIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8 11V4.5a1.5 1.5 0 0 1 3 0V10" strokeLinecap="round" />
      <path d="M11 10V3.5a1.5 1.5 0 0 1 3 0V10" strokeLinecap="round" />
      <path d="M14 10.5V4a1.5 1.5 0 0 1 3 0v9" strokeLinecap="round" />
      <path d="M17 11v-1.5a1.5 1.5 0 0 1 3 0V15c0 3.9-2.9 7-7 7h-1c-2.2 0-3.6-.8-5-2.3L4 16.4c-.6-.7-.5-1.7.2-2.2.6-.5 1.5-.4 2 .1L8 16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CaptionIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2" y="4" width="20" height="14" rx="2.5" />
      <path d="M6 14h4M12 14h6M6 10.5h12" strokeLinecap="round" />
    </svg>
  );
}

export function LogoutIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LinkIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HearingUserIcon({ size = 48 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="32" cy="32" r="28" opacity="0.1" fill="currentColor" />
      {/* Head */}
      <circle cx="32" cy="20" r="8" />
      {/* Body */}
      <path d="M32 28v12" strokeWidth="2" />
      {/* Arms */}
      <path d="M24 34h16" strokeWidth="2" />
      {/* Legs */}
      <path d="M28 40v8" strokeWidth="2" />
      <path d="M36 40v8" strokeWidth="2" />
      {/* Sound waves for hearing */}
      <path d="M44 18c1 1.5 1.5 3.5 1.5 5.5s-.5 4-1.5 5.5" strokeWidth="2" />
      <path d="M48 14c2 3 3 6.5 3 10s-1 7-3 10" strokeWidth="2" />
    </svg>
  );
}

export function DeafUserIcon({ size = 48 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="32" cy="32" r="28" opacity="0.1" fill="currentColor" />
      {/* Head */}
      <circle cx="32" cy="20" r="8" />
      {/* Body */}
      <path d="M32 28v12" strokeWidth="2" />
      {/* Arms raised for sign language */}
      <path d="M20 32c-3-2-5-6-5-10" strokeWidth="2" />
      <path d="M44 32c3-2 5-6 5-10" strokeWidth="2" />
      {/* Legs */}
      <path d="M28 40v8" strokeWidth="2" />
      <path d="M36 40v8" strokeWidth="2" />
      {/* Hand gestures */}
      <path d="M16 30 Q14 28 15 26" strokeWidth="2" />
      <path d="M48 30 Q50 28 49 26" strokeWidth="2" />
    </svg>
  );
}

export function MuteUserIcon({ size = 48 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="32" cy="32" r="28" opacity="0.1" fill="currentColor" />
      {/* Head */}
      <circle cx="32" cy="20" r="8" />
      {/* Body */}
      <path d="M32 28v12" strokeWidth="2" />
      {/* Arms */}
      <path d="M24 34h16" strokeWidth="2" />
      {/* Legs */}
      <path d="M28 40v8" strokeWidth="2" />
      <path d="M36 40v8" strokeWidth="2" />
      {/* Keyboard/typing indicator */}
      <rect x="20" y="48" width="24" height="6" rx="1" fill="none" strokeWidth="1.5" />
      <line x1="24" y1="48" x2="24" y2="54" strokeWidth="1.5" />
      <line x1="32" y1="48" x2="32" y2="54" strokeWidth="1.5" />
      <line x1="40" y1="48" x2="40" y2="54" strokeWidth="1.5" />
    </svg>
  );
}

export function EyeIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

