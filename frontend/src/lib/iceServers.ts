// ICE servers used for NAT traversal.
// STUN (free, Google's public server) handles most cases.
// TURN is a fallback for restrictive networks — replace the placeholder
// below with your own TURN server details before your remote-network demo.
export const iceServers: RTCIceServer[] = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
  // Example TURN config — uncomment and fill in once you have one:
  // {
  //   urls: "turn:your-turn-server.com:3478",
  //   username: "your-username",
  //   credential: "your-credential",
  // },
];