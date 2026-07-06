import { useState } from "react";
import { Welcome } from "./pages/Welcome";
import { SignUp } from "./pages/SignUp";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { Room } from "./pages/Room";
import { getRoomIdFromUrl } from "./lib/roomId";
import { useAuth } from "./context/AuthContext";

type View = "welcome" | "signup" | "login" | "home" | "room";

function App() {
  const { user } = useAuth();

  // If someone opened a shared invite link (e.g. /room/swift-otter-4821),
  // remember that room so we can drop them straight into it once they've
  // signed up or logged in.
  const [pendingRoomId] = useState<string | null>(() => getRoomIdFromUrl());
  const [roomId, setRoomId] = useState<string | null>(null);

  // Decide the initial view: already logged in + has a room link -> straight
  // to the room. Already logged in, no room link -> home. Otherwise welcome.
  const [view, setView] = useState<View>(() => {
    if (user && pendingRoomId) return "room";
    if (user) return "home";
    return "welcome";
  });

  // Keep roomId in sync with the pending link once we land in "room" view.
  if (view === "room" && !roomId && pendingRoomId) {
    setRoomId(pendingRoomId);
  }

  function handleAuthSuccess() {
    if (pendingRoomId) {
      window.history.pushState({}, "", `/room/${pendingRoomId}`);
      setRoomId(pendingRoomId);
      setView("room");
    } else {
      setView("home");
    }
  }

  function handleJoinRoom(id: string) {
    window.history.pushState({}, "", `/room/${id}`);
    setRoomId(id);
    setView("room");
  }

  function handleLeaveRoom() {
    window.history.pushState({}, "", "/");
    setRoomId(null);
    setView("home");
  }

  switch (view) {
    case "welcome":
      return (
        <Welcome
          onSignUp={() => setView("signup")}
          onLogIn={() => setView("login")}
        />
      );
    case "signup":
      return (
        <SignUp
          onSuccess={handleAuthSuccess}
          onSwitchToLogin={() => setView("login")}
          onBack={() => setView("welcome")}
        />
      );
    case "login":
      return (
        <Login
          onSuccess={handleAuthSuccess}
          onSwitchToSignUp={() => setView("signup")}
          onBack={() => setView("welcome")}
        />
      );
    case "home":
      return <Home onJoin={handleJoinRoom} />;
    case "room":
      return roomId ? (
        <Room roomId={roomId} onLeave={handleLeaveRoom} />
      ) : (
        <Home onJoin={handleJoinRoom} />
      );
  }
}

export default App;