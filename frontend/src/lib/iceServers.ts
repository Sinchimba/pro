const envTurnUrl = import.meta.env.VITE_TURN_URL;
const envTurnUsername = import.meta.env.VITE_TURN_USERNAME;
const envTurnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

// Safely validate environment variables to prevent empty/placeholder configurations
const isUrlValid = envTurnUrl && envTurnUrl !== "undefined" && envTurnUrl !== "null" && envTurnUrl.trim() !== "";

const turnServers: RTCIceServer[] = isUrlValid
  ? [
      {
        urls: envTurnUrl.split(",").map((url) => url.trim()),
        username: envTurnUsername && envTurnUsername !== "undefined" ? envTurnUsername : undefined,
        credential: envTurnCredential && envTurnCredential !== "undefined" ? envTurnCredential : undefined,
      },
    ]
  : [
      {
        urls: [
          "turn:openrelay.metered.ca:80",
          "turn:openrelay.metered.ca:443",
          "turn:openrelay.metered.ca:443?transport=tcp",
          "turns:openrelay.metered.ca:443",
          "turns:openrelay.metered.ca:443?transport=tcp",
        ],
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ];

export const iceServers: RTCIceServer[] = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
      "stun:stun3.l.google.com:19302",
      "stun:stun4.l.google.com:19302",
      "stun:openrelay.metered.ca:80",
    ],
  },
  ...turnServers,
];