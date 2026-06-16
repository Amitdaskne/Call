export interface CallState {
  roomId: string;
  peerId: string;
  isCaller: boolean;
  status: 'idle' | 'dialing' | 'ringing' | 'connected' | 'ended' | 'failed';
  mediaStream: MediaStream | null;
  remoteStream: MediaStream | null;
  audioMuted: boolean;
  videoMuted: boolean;
  cameraFacing: 'user' | 'environment';
  callType: 'peer' | 'ai';
  duration: number; // call duration in seconds
}

export interface SignalingMessage {
  from: string;
  target?: string;
  message: {
    type: 'joined' | 'peer-left' | 'offer' | 'answer' | 'ice-candidate' | 'mute-state';
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    audioMuted?: boolean;
    videoMuted?: boolean;
    peerId?: string;
  };
}

export interface AIRecord {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
}

export interface PhoneContact {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  statusText: string;
  isAi: boolean;
  aiPersona?: string;
}
