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

export function GlobeIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9s1.3-6.5 3.8-9z" />
    </svg>
  );
}

export function ShieldIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 2.5l7.5 3.2V11c0 5.2-3.3 8.8-7.5 10.5C7.8 19.8 4.5 16.2 4.5 11V5.7L12 2.5z" strokeLinejoin="round" />
      <path d="M9 12l2.2 2.2L15.5 9.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LinkIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" strokeLinecap="round" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" strokeLinecap="round" />
    </svg>
  );
}

export function UsersIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 19c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" strokeLinecap="round" />
      <path d="M16 4.3c1.7.4 3 2 3 3.9 0 1.9-1.3 3.5-3 3.9M21.5 19c0-2.8-2.1-5.1-5-5.8" strokeLinecap="round" />
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