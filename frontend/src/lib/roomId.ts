/**
 * Generates a short, readable, unique room code — e.g. "swift-otter-4821".
 * Good for a shareable meeting link: memorable enough to read aloud,
 * random enough to avoid collisions for an MVP's scale.
 */
const ADJECTIVES = [
  "swift", "calm", "bright", "quiet", "bold",
  "golden", "silver", "amber", "azure", "coral",
];
const NOUNS = [
  "otter", "falcon", "harbor", "meadow", "cedar",
  "comet", "ridge", "delta", "lantern", "summit",
];

export function generateRoomId(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const number = Math.floor(1000 + Math.random() * 9000);
  return `${adjective}-${noun}-${number}`;
}

/** Builds the full shareable URL for a given room code. */
export function buildRoomLink(roomId: string): string {
  return `${window.location.origin}/room/${roomId}`;
}

/** Reads a room code out of the current URL, if present (e.g. /room/swift-otter-4821). */
export function getRoomIdFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/room\/([^/]+)$/);
  return match ? match[1] : null;
}