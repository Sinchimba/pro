import { useState } from "react";
import { generateRoomId } from "../lib/roomId";
import "./Home.css";

interface HomeProps {
  onJoin: (roomId: string) => void;
}

export function Home({ onJoin }: HomeProps) {
  const [roomId, setRoomId] = useState("");

  function handleJoin() {
    const trimmed = roomId.trim();
    if (trimmed) {
      onJoin(trimmed);
    }
  }

  function handleCreate() {
    onJoin(generateRoomId());
  }

  return (
    <div className="home">
      <div className="home-card">
        <div className="eyebrow">
          <span className="pulse-dot" />
          Signal ready
        </div>
        <h1>Smart Meeting</h1>
        <p>
          Live video, captions, and sign language conversion in one room.
          Start a new meeting or join one with a code.
        </p>

        <button className="create-button" onClick={handleCreate}>
          Create new meeting
        </button>

        <div className="divider">
          <span>or join with a code</span>
        </div>

        <div className="room-input-row">
          <input
            className="room-input"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="room-code"
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
          <button
            className="join-button"
            onClick={handleJoin}
            disabled={!roomId.trim()}
          >
            Join
          </button>
        </div>
      </div>
    </div>
  );
}