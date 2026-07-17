export interface RemoteStream {
  socketId: string;
  name: string;
  stream: MediaStream;
  videoOff?: boolean;
  audioOff?: boolean;
}