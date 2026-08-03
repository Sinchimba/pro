const envTurnUrl = import.meta.env.VITE_TURN_URL;
const envTurnUsername = import.meta.env.VITE_TURN_USERNAME;
const envTurnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

const turnServers: RTCIceServer[] = envTurnUrl
  ? [
      {
        urls: envTurnUrl.split(",").map((url) => url.trim()),
        username: envTurnUsername,
        credential: envTurnCredential,
      },
    ]
  : [
      {
        urls: [
          "turn:openrelay.metered.ca:80",
          "turn:openrelay.metered.ca:443",
          "turn:openrelay.metered.ca:443?transport=tcp",
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