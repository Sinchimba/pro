import { useState, useRef } from "react";
import type { ChangeEvent } from "react";
import { SendIcon, PaperclipIcon, SmileIcon } from "./Icons";
import type { ChatMessage, ChatFile } from "../../hooks/useChat";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string, file?: ChatFile) => void;
  onClose: () => void;
}

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "👏", "🔥", "🙌", "💡"];

export function ChatPanel({ messages, onSend, onClose }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [selectedFile, setSelectedFile] = useState<ChatFile | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSend() {
    if (!draft.trim() && !selectedFile) return;
    onSend(draft, selectedFile || undefined);
    setDraft("");
    setSelectedFile(null);
    setEmojiOpen(false);
  }

  function handleFileClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Restrict to 2MB to keep WebSocket payload lightweight
    if (file.size > 2 * 1024 * 1024) {
      alert("File size exceeds 2MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedFile({
        name: file.name,
        type: file.type,
        size: file.size,
        data: event.target?.result as string,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // Reset input
  }

  function appendEmoji(emoji: string) {
    setDraft((prev) => prev + emoji);
    setEmojiOpen(false);
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  return (
    <div className="mr-chat-panel">
      <div className="mr-chat-header">
        <span>In-call messages</span>
        <button onClick={onClose} aria-label="Close chat">
          ×
        </button>
      </div>

      <div className="mr-chat-messages">
        {messages.length === 0 && (
          <div className="mr-chat-empty">
            No messages yet — say hello to everyone in the meeting.
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mr-chat-message ${msg.isMe ? "is-me" : ""}`}
          >
            <div className="mr-chat-message-name">
              {msg.isMe ? "You" : msg.name}
            </div>
            
            <div className="mr-chat-message-bubble">
              {msg.text && <p className="mr-chat-message-text">{msg.text}</p>}
              
              {msg.file && (
                <div className="mr-chat-attachment">
                  {msg.file.type.startsWith("image/") ? (
                    <img
                      src={msg.file.data}
                      alt={msg.file.name}
                      className="mr-chat-image-preview"
                    />
                  ) : (
                    <div className="mr-chat-file-card">
                      <PaperclipIcon size={14} />
                      <span className="mr-chat-file-name" title={msg.file.name}>
                        {msg.file.name}
                      </span>
                      <span className="mr-chat-file-size">
                        ({formatBytes(msg.file.size)})
                      </span>
                    </div>
                  )}
                  <a
                    href={msg.file.data}
                    download={msg.file.name}
                    className="mr-chat-download-link"
                  >
                    Download
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedFile && (
        <div className="mr-chat-file-preview-bar">
          <span className="mr-chat-file-preview-name" title={selectedFile.name}>
            📎 {selectedFile.name} ({formatBytes(selectedFile.size)})
          </span>
          <button
            className="mr-chat-file-preview-remove"
            onClick={() => setSelectedFile(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="mr-chat-input-container">
        {emojiOpen && (
          <div className="mr-chat-emoji-popover">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => appendEmoji(emoji)}
                className="mr-chat-emoji-btn"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="mr-chat-input-row">
          <button
            className="mr-chat-input-icon-btn"
            onClick={() => setEmojiOpen((v) => !v)}
            title="Add emoji"
          >
            <SmileIcon size={18} />
          </button>
          
          <button
            className="mr-chat-input-icon-btn"
            onClick={handleFileClick}
            title="Attach file"
          >
            <PaperclipIcon size={18} />
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Send a message..."
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          
          <button
            className="mr-chat-send-btn"
            onClick={handleSend}
            disabled={!draft.trim() && !selectedFile}
          >
            <SendIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}