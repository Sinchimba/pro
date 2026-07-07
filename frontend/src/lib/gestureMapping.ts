/**
 * MediaPipe's Gesture Recognizer ships with 7 pretrained hand gestures.
 * These are NOT full ASL vocabulary, but they're real, working, pretrained
 * recognition (no training data needed from you), and one of them
 * (ILoveYou) is an authentic ASL sign. This is an honest, achievable scope
 * for sign -> text recognition within your timeline.
 *
 * Extending this later to true ASL words would require collecting labeled
 * hand-landmark data per sign and training a custom classifier on top of
 * MediaPipe's hand-landmark output (a much bigger undertaking) — worth
 * mentioning as "future work" in your report.
 */
export const GESTURE_TO_TEXT: Record<string, string> = {
  Thumb_Up: "yes",
  Thumb_Down: "no",
  Open_Palm: "hello",
  Closed_Fist: "wait",
  Victory: "peace",
  Pointing_Up: "attention, please",
  ILoveYou: "I love you",
};

export function gestureLabelToText(category: string): string | null {
  return GESTURE_TO_TEXT[category] ?? null;
}