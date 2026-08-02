// Speech queue to coordinate all Text-to-Speech requests in the app.
// This prevents overlapping, interrupted speech and ensures correct queuing and synchronization with animations.

export interface SpeechQueueItem {
  id: string; // unique ID to prevent duplicate plays of the same event
  text: string;
  silent?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
}

class SpeechQueue {
  private queue: SpeechQueueItem[] = [];
  private speaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private playedIds = new Set<string>();

  public enqueue(item: SpeechQueueItem) {
    // Avoid duplicate requests within a short timeframe (e.g. 1.5 seconds)
    if (this.playedIds.has(item.id)) {
      return;
    }
    this.playedIds.add(item.id);
    setTimeout(() => {
      this.playedIds.delete(item.id);
    }, 1500);

    this.queue.push(item);
    this.processNext();
  }

  private processNext() {
    if (this.speaking || this.queue.length === 0) return;

    const item = this.queue.shift();
    if (!item) return;

    this.speaking = true;

    const utterance = new SpeechSynthesisUtterance(item.text);
    this.currentUtterance = utterance;

    if (item.silent) {
      utterance.volume = 0;
    }

    utterance.onstart = () => {
      if (item.onStart) {
        item.onStart();
      }
    };

    const handleEnd = () => {
      if (!this.speaking) return;
      this.speaking = false;
      this.currentUtterance = null;
      window.clearTimeout(timeoutId);
      if (item.onEnd) {
        item.onEnd();
      }
      setTimeout(() => this.processNext(), 150);
    };

    utterance.onend = handleEnd;
    utterance.onerror = (e) => {
      console.warn("[SpeechQueue] utterance error/interrupted:", e);
      handleEnd();
    };

    // Safety timeout in case speech synthesis fails silently or is blocked by browser policies
    const timeoutId = window.setTimeout(() => {
      if (this.currentUtterance === utterance && this.speaking) {
        console.warn("[SpeechQueue] SpeechSynthesis timed out. Force recovering...");
        handleEnd();
      }
    }, Math.max(3500, item.text.length * 150));

    window.speechSynthesis.speak(utterance);
  }

  public cancelAll() {
    this.queue = [];
    this.speaking = false;
    this.currentUtterance = null;
    this.playedIds.clear();
    window.speechSynthesis.cancel();
  }
}

export const speechQueue = new SpeechQueue();
