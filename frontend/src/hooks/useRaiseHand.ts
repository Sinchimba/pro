import { useEffect, useState } from "react";
import { socket } from "../lib/socket";

/**
 * Tracks raised hands for everyone in the room. Your own toggle is local
 * state; other participants' raised hands arrive via the signaling server.
 */
export function useRaiseHand(roomId: string) {
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [othersRaised, setOthersRaised] = useState<Set<string>>(new Set());

  useEffect(() => {
    function handleRaiseHand({
      socketId,
      raised,
    }: {
      socketId: string;
      raised: boolean;
    }) {
      setOthersRaised((prev) => {
        const next = new Set(prev);
        if (raised) next.add(socketId);
        else next.delete(socketId);
        return next;
      });
    }

    socket.on("raise-hand", handleRaiseHand);
    return () => {
      socket.off("raise-hand", handleRaiseHand);
    };
  }, []);

  function toggleHand() {
    const next = !isHandRaised;
    setIsHandRaised(next);
    socket.emit("raise-hand", { roomId, raised: next });
  }

  return { isHandRaised, othersRaised, toggleHand };
}