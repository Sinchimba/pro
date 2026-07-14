import { GestureRecognizer, FilesetResolver } from "@mediapipe/tasks-vision";

let recognizerPromise: Promise<GestureRecognizer> | null = null;

/**
 * Shared singleton promise for loading the MediaPipe GestureRecognizer.
 * This guarantees only a single instance of the recognizer is loaded, compiled,
 * and created in memory, avoiding double-loading WebAssembly assets and WebGL contexts.
 */
export function getSharedGestureRecognizer(): Promise<GestureRecognizer> {
  if (!recognizerPromise) {
    recognizerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );
      return GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });
    })();
  }
  return recognizerPromise;
}
