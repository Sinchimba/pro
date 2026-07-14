/**
 * Fixed vocabulary for text -> sign lookup (Phase 3 of the project plan).
 *
 * IMPORTANT: `videoUrl` points to a file that needs to actually exist in
 * `frontend/public/sign-clips/`. These are NOT included — you need to add
 * real video clips yourself (e.g. record short clips of each sign on your
 * phone, or use footage you have rights to use). Until a clip exists at
 * that path, the SignPanel will show a "clip needed" placeholder instead
 * of failing silently.
 *
 * Keep this list to your mentor-approved scope (30-50 signs). Add more
 * entries here as you record more clips — no other code changes needed.
 */
export interface SignEntry {
  word: string;
  videoUrl: string;
}

export const SIGN_VOCABULARY: SignEntry[] = [
  { word: "hello", videoUrl: "/sign-clips/Hello.mp4" },
  { word: "thank you", videoUrl: "/sign-clips/thank-you.mp4" },
  { word: "please", videoUrl: "/sign-clips/Please.mp4" },
  { word: "yes", videoUrl: "/sign-clips/yes.mp4" },
  { word: "no", videoUrl: "/sign-clips/no.mp4" },
  { word: "help", videoUrl: "/sign-clips/help.mp4" },
  { word: "sorry", videoUrl: "/sign-clips/sorry.mp4" },
  { word: "good", videoUrl: "/sign-clips/good.mp4" },
  { word: "meeting", videoUrl: "/sign-clips/meeting.mp4" },
  { word: "wait", videoUrl: "/sign-clips/wait.mp4" },
  { word: "understand", videoUrl: "/sign-clips/understand.mp4" },
  { word: "my name", videoUrl: "/sign-clips/myname.mp4" },
  { word: "nice to meet with you", videoUrl: "/sign-clips/nice to meet with you.mp4" },
  { word: "me" , videoUrl: "/sign-clips/Me.mp4" },
];

/**
 * Finds the first vocabulary word that appears as a whole word/phrase
 * inside the given text. Case-insensitive. Returns null if no match.
 */
export function matchSignWord(text: string): SignEntry | null {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  
  // Iterate backwards from the end of the text to identify the most recently spoken sign word/phrase
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    
    // Check multi-word phrases by joining preceding words
    for (const len of [6, 5, 4, 3, 2]) {
      if (i - len + 1 >= 0) {
        const phrase = words.slice(i - len + 1, i + 1).join(" ");
        const match = SIGN_VOCABULARY.find(entry => entry.word.toLowerCase() === phrase);
        if (match) return match;
      }
    }

    const match = SIGN_VOCABULARY.find(entry => entry.word.toLowerCase() === word);
    if (match) return match;
  }
  return null;
}