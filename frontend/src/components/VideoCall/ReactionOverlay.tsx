import { useEffect, useState } from "react";
import { socket } from "../../lib/socket";

interface Reaction {
  id: string;
  emoji: string;
  left: number; // Percentage from left (20% - 80%)
  delay: number;
}

interface ReactionOverlayProps {
  roomId: string;
}

export function ReactionOverlay({ roomId }: ReactionOverlayProps) {
  const [reactions, setReactions] = useState<Reaction[]>([]);

  useEffect(() => {
    function handleIncomingReaction({
      socketId: _,
      emoji,
    }: {
      socketId: string;
      emoji: string;
    }) {
      triggerEmoji(emoji);
    }

    socket.on("reaction", handleIncomingReaction);
    return () => {
      socket.off("reaction", handleIncomingReaction);
    };
  }, []);

  function triggerEmoji(emoji: string) {
    const id = Math.random().toString(36).substring(2, 9);
    // Random horizontal start position between 30% and 70%
    const left = 30 + Math.random() * 40;
    const newReaction: Reaction = { id, emoji, left, delay: Math.random() * 0.2 };

    setReactions((prev) => [...prev, newReaction]);

    // Clean up reaction after animation completes (3 seconds)
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 3000);
  }

  // Expose local trigger so Room can call it when the local user reacts
  // We can attach it to window for easy access or just pass a trigger prop,
  // but registering a global event listener is very clean!
  useEffect(() => {
    function handleLocalReaction(e: CustomEvent<string>) {
      const emoji = e.detail;
      triggerEmoji(emoji);
      socket.emit("reaction", { roomId, emoji });
    }

    window.addEventListener("local-reaction" as any, handleLocalReaction);
    return () => {
      window.removeEventListener("local-reaction" as any, handleLocalReaction);
    };
  }, [roomId]);

  return (
    <div className="reaction-overlay-container">
      {reactions.map((r) => (
        <span
          key={r.id}
          className="floating-reaction"
          style={{
            left: `${r.left}%`,
            animationDelay: `${r.delay}s`,
          }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}
