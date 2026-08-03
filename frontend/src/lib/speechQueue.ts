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
  private currentTimeoutId: number | null = null;

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

    if (item.silent) {
      if (item.onStart) {
        try {
          item.onStart();
        } catch (e) {
          console.error("[SpeechQueue] error in onStart:", e);
        }
      }
      const duration = Math.max(1500, item.text.length * 120);
      this.currentTimeoutId = window.setTimeout(() => {
        this.speaking = false;
        this.currentTimeoutId = null;
        if (item.onEnd) {
          try {
            item.onEnd();
          } catch (e) {
            console.error("[SpeechQueue] error in onEnd:", e);
          }
        }
        setTimeout(() => this.processNext(), 150);
      }, duration);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(item.text);
    this.currentUtterance = utterance;

    utterance.onstart = () => {
      if (item.onStart) {
        item.onStart();
      }
    };

    const handleEnd = () => {
      if (!this.speaking) return;
      this.speaking = false;
      this.currentUtterance = null;
      if (this.currentTimeoutId) {
        window.clearTimeout(this.currentTimeoutId);
        this.currentTimeoutId = null;
      }
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
    this.currentTimeoutId = window.setTimeout(() => {
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
    if (this.currentTimeoutId) {
      window.clearTimeout(this.currentTimeoutId);
      this.currentTimeoutId = null;
    }
    window.speechSynthesis.cancel();
  }
}

export const speechQueue = new SpeechQueue();
