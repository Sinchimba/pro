import { useEffect, useState } from "react";
import { socket } from "../lib/socket";

export interface ChatFile {
  name: string;
  type: string;
  size: number;
  data: string; // Base64 data URL
}

export interface ChatMessage {
  socketId: string;
  name: string;
  text: string;
  file?: ChatFile;
  timestamp: number;
  isMe?: boolean;
}

/**
 * Simple real-time chat scoped to a room. Messages are relayed by the
 * signaling server and NOT persisted anywhere — they disappear when the
 * meeting ends, same as most video call chat panels.
 */
export function useChat(roomId: string, myName: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    function handleIncoming(msg: ChatMessage) {
      setMessages((prev) => [...prev, msg]);
      setUnreadCount((prev) => prev + 1);
    }

    socket.on("chat-message", handleIncoming);
    return () => {
      socket.off("chat-message", handleIncoming);
    };
  }, []);

  function sendMessage(text: string, file?: ChatFile) {
    const trimmed = text.trim();
    if (!trimmed && !file) return;

    socket.emit("chat-message", { roomId, name: myName, text: trimmed, file });

    // Show our own message immediately (server only relays to others).
    setMessages((prev) => [
      ...prev,
      {
        socketId: "me",
        name: myName,
        text: trimmed,
        file,
        timestamp: Date.now(),
        isMe: true,
      },
    ]);
  }

  function markAllRead() {
    setUnreadCount(0);
  }

  return { messages, sendMessage, unreadCount, markAllRead };
}