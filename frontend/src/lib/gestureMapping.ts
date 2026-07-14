
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