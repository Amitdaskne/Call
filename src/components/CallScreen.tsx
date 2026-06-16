import React, { useEffect, useRef, useState } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, RotateCw, Copy, Check, MessageSquare, Send, Sparkles, AlertCircle 
} from 'lucide-react';
import { AudioWave } from './AudioWave';
import { PhoneContact } from '../types';

interface CallScreenProps {
  status: 'dialing' | 'ringing' | 'connected' | 'ended' | 'failed';
  callType: 'peer' | 'ai';
  contact: PhoneContact | null;
  roomId: string;
  duration: number;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  audioMuted: boolean;
  videoMuted: boolean;
  cameraFacing: 'user' | 'environment';
  aiTranscript: Array<{ sender: 'user' | 'ai', text: string }>;
  aiSpeaking: boolean;
  aiThinking: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onFlipCamera: () => void;
  onHangup: () => void;
  onSendTextMessage: (text: string) => void;
}

export const CallScreen: React.FC<CallScreenProps> = ({
  status,
  callType,
  contact,
  roomId,
  duration,
  localStream,
  remoteStream,
  audioMuted,
  videoMuted,
  cameraFacing,
  aiTranscript,
  aiSpeaking,
  aiThinking,
  onToggleMute,
  onToggleVideo,
  onFlipCamera,
  onHangup,
  onSendTextMessage
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showChat, setShowChat] = useState(false);

  // Bind WebRTC native video streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, videoMuted]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Scroll transcripts automatically
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiTranscript, aiThinking]);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      onSendTextMessage(textInput.trim());
      setTextInput('');
    }
  };

  const currentSpeaker = contact || {
    id: 'unknown',
    name: 'External Peer',
    role: 'WebRTC Caller',
    avatarColor: 'from-neutral-400 to-neutral-600',
    statusText: '',
    isAi: false
  };

  return (
    <div className="relative flex flex-col justify-between h-full bg-slate-950 text-slate-50 overflow-hidden font-sans select-none">
      
      {/* Morphing Deep Background Gradients */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className={`absolute -top-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-tr ${currentSpeaker.avatarColor} opacity-5 blur-[120px] animate-pulse`} style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-slate-800/10 to-indigo-900/10 opacity-10 blur-[140px] animate-pulse" style={{ animationDuration: '10s' }} />
      </div>

      {/* TOP HEADER SECTION */}
      <div className="relative z-10 w-full pt-6 px-5 flex flex-col items-center shrink-0">
        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800/50 px-3 py-1.5 rounded-full text-[9px] tracking-widest text-slate-400 uppercase font-semibold">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse' : 'bg-amber-400 animate-bounce'}`} />
          {callType === 'ai' ? `AI Hotline • ${currentSpeaker.name}` : `Encrypted WebRTC P2P Line`}
        </div>

        {/* Timer / Call Status text */}
        <div className="text-xs font-medium tracking-widest text-slate-400 uppercase mt-3">
          {status === 'connected' ? (
            <span className="font-mono text-sm text-slate-100 tracking-wider">Connected — {formatDuration(duration)}</span>
          ) : status === 'dialing' ? (
            'Dialing lines...'
          ) : status === 'ringing' ? (
            'Establishing secure peer connection...'
          ) : (
            'Connecting carrier...'
          )}
        </div>

        {/* Room Link Sharing Card (for Peer P2P calls only) */}
        {callType === 'peer' && status !== 'connected' && (
          <div className="w-full max-w-xs mt-4 p-3 rounded-2xl bg-slate-900/90 border border-slate-800/80 text-center space-y-2 shrink-0 shadow-lg">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Invite a Peer to Join</span>
            <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl text-xs border border-slate-800/80">
              <span className="font-mono text-emerald-400 select-all font-semibold px-1 shrink">{roomId}</span>
              <button
                id="btn-copy-invite"
                onClick={handleCopyLink}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all scale-95 shrink-0"
                title="Copy Invite URL"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[9px] text-slate-500 leading-normal">
              Share your room ID with a partner or open this URL in another browser window to connect.
            </p>
          </div>
        )}
      </div>

      {/* CENTER WORKSPACE SECTION */}
      <div className="relative flex-1 z-10 w-full flex flex-col justify-center items-center px-4 overflow-hidden my-2">
        
        {/* PEER-TO-PEER VIDEO CANVAS */}
        {callType === 'peer' && (
          <div className="relative w-full h-full max-h-[440px] rounded-3xl bg-slate-900/40 border border-slate-800/80 overflow-hidden flex items-center justify-center p-1 shadow-2xl">
            
            {/* Fullscreen Remote Video Track */}
            {remoteStream && status === 'connected' ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <div className="text-center space-y-4 z-10 p-6">
                <div className="relative flex items-center justify-center">
                  <div className={`w-32 h-32 rounded-full mx-auto bg-gradient-to-tr ${currentSpeaker.avatarColor} p-1 flex items-center justify-center text-white font-light text-3xl shadow-xl z-10`}>
                    <div className="w-full h-full rounded-full bg-slate-950/60 backdrop-blur-sm flex items-center justify-center">
                      {currentSpeaker.name.charAt(0)}
                    </div>
                  </div>
                  <div className="absolute -inset-2 border border-slate-850 rounded-full opacity-20 animate-pulse"></div>
                  <div className="absolute -inset-6 border border-slate-900 rounded-full opacity-10"></div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-widest">{currentSpeaker.name}</h3>
                  <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-widest">Waiting for peer connection...</p>
                </div>
              </div>
            )}

            {/* PIP Floating Local Webcam Track (Top Right) */}
            {localStream && (
              <div className="absolute top-4 right-4 w-28 aspect-[3/4] rounded-2xl bg-slate-950/90 border border-slate-800 shadow-2xl overflow-hidden z-20 transition-all">
                {!videoMuted ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                    <VideoOff className="w-4 h-4 mb-1" />
                    <span className="text-[9px] uppercase font-bold text-slate-600 tracking-wider">Muted</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* AI HOTLINE COMPANION DISPLAY */}
        {callType === 'ai' && (
          <div className="w-full max-w-sm flex flex-col justify-between h-full max-h-[440px] relative">
            
            {/* Visual Avatar State with Minimal Rings */}
            <div className={`flex flex-col items-center justify-center ${showChat ? 'mt-0' : 'mt-10'} transition-all`}>
              <div className="relative flex items-center justify-center">
                <div className={`w-36 h-36 rounded-full border border-slate-800 flex items-center justify-center p-2 z-10 bg-slate-950/90 ${aiSpeaking ? 'scale-102 transition-all' : 'scale-100'}`}>
                  <div className={`w-full h-full rounded-full bg-gradient-to-tr ${currentSpeaker.avatarColor} p-0.5 flex items-center justify-center text-slate-100 text-3xl font-light shadow-2xl`}>
                    <div className="w-full h-full rounded-full bg-slate-950/40 backdrop-blur-sm flex items-center justify-center">
                      {currentSpeaker.name.charAt(0)}
                    </div>
                  </div>
                </div>
                {/* Clean Minimalism Radial Halo Overlays */}
                <div className="absolute -inset-4 border border-slate-800 rounded-full opacity-20"></div>
                <div className="absolute -inset-10 border border-slate-800 rounded-full opacity-10"></div>
                {aiSpeaking && (
                  <div className="absolute -inset-14 border border-emerald-500/10 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
                )}
              </div>
              <h3 className="text-xl font-light text-slate-100 tracking-tight mt-12">{currentSpeaker.name}</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">{currentSpeaker.role}</p>
            </div>

            {/* Integrated Real-Time Speech Subtitle Caption Area */}
            <div className={`flex-1 overflow-y-auto px-1 py-3 my-2 border-t border-b border-slate-900/80 custom-scrollbar flex flex-col ${showChat ? 'max-h-[110px]' : 'max-h-[160px]'} justify-end`}>
              {aiTranscript.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-900/20 border border-slate-800/40 text-center text-slate-500 text-xs italic space-y-1">
                  <Sparkles className="w-3.5 h-3.5 mx-auto text-slate-650 block" />
                  <span>Start speaking to prompt companion, or toggle keyboard fallback.</span>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {aiTranscript.map((msg, index) => (
                    <div 
                      key={index}
                      className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start animate-fade-in'}`}
                    >
                      <span className="text-[9px] uppercase tracking-widest font-bold text-slate-500 mb-1">
                        {msg.sender === 'user' ? 'You' : currentSpeaker.name}
                      </span>
                      <div className={`text-xs px-3.5 py-2 rounded-2xl max-w-[85%] leading-relaxed ${
                        msg.sender === 'user' 
                          ? 'bg-slate-100 text-slate-950 font-medium rounded-tr-none' 
                          : 'bg-slate-900 text-slate-200 border border-slate-800/80 rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  
                  {/* AI Response typing cursor */}
                  {aiThinking && (
                    <div className="flex flex-col items-start animate-pulse">
                      <span className="text-[9px] uppercase tracking-widest font-bold text-slate-500 mb-1">{currentSpeaker.name}</span>
                      <div className="bg-slate-900/50 border border-slate-800 px-3.5 py-2.5 rounded-2xl rounded-tl-none flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
                      </div>
                    </div>
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              )}
            </div>

            {/* Waveform Drawing Visualizer */}
            <div className="shrink-0">
              <AudioWave isTalking={aiSpeaking} colorClass={currentSpeaker.avatarColor.includes('emerald') ? 'emerald' : currentSpeaker.avatarColor.includes('sky') ? 'blue' : currentSpeaker.avatarColor.includes('amber') ? 'amber' : 'red'} />
            </div>

            {/* Speech Keyboard Fallback (Text box inside calling layout) */}
            {showChat && (
              <form onSubmit={handleSendText} className="relative z-30 flex items-center gap-1.5 bg-slate-900/95 border border-slate-800 p-1.5 rounded-2xl text-xs mt-1 animate-fade-in shrink-0">
                <input
                  type="text"
                  placeholder="Type a message to prompt companion..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="flex-1 bg-transparent px-2.5 py-2 text-slate-100 outline-none text-xs placeholder-slate-600"
                  disabled={aiThinking}
                />
                <button
                  id="btn-send-chat"
                  type="submit"
                  disabled={!textInput.trim() || aiThinking}
                  className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-white disabled:bg-slate-800 disabled:text-slate-650 active:scale-95 flex items-center justify-center text-slate-950 transition-all shrink-0 font-medium"
                >
                  <Send className="w-3.5 h-3.5 fill-current" />
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM CONTROL RING BUTTONS SECTION */}
      <div className="relative z-10 w-full pt-2 pb-6 px-4 bg-gradient-to-t from-slate-950 to-slate-950/0 flex flex-col items-center shrink-0">
        
        {/* Helper status text for mic/webcam */}
        {status === 'failed' && (
          <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-center text-red-400 text-[10px] flex items-center gap-2 max-w-xs leading-tight font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Connection timeout: Secure signaling lines are unavailable. Try dialed code again!</span>
          </div>
        )}

        {/* Clean Minimalism Foot Control Console */}
        <div className="max-w-xl mx-auto flex items-center justify-between gap-6 w-full px-2">
          
          {/* Mic Toggle */}
          <div className="flex flex-col items-center gap-2.5">
            <button
              id="control-mute"
              onClick={onToggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                audioMuted 
                  ? 'bg-red-500 text-white' 
                  : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
              title={audioMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {audioMuted ? <MicOff className="w-5.5 h-5.5" /> : <Mic className="w-5.5 h-5.5" />}
            </button>
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Mute</span>
          </div>

          {/* Video Toggle */}
          <div className="flex flex-col items-center gap-2.5">
            <button
              id="control-video"
              onClick={callType === 'peer' ? onToggleVideo : () => setShowChat(!showChat)}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white hover:bg-slate-700 cursor-pointer ${
                callType === 'peer' && videoMuted ? 'bg-red-500' : 'bg-slate-800'
              }`}
              title={callType === 'peer' ? (videoMuted ? "Activate Webcam" : "Disable Webcam") : "Toggle Keyboard Overlay"}
            >
              {callType === 'peer' ? (
                videoMuted ? <VideoOff className="w-5.5 h-5.5" /> : <Video className="w-5.5 h-5.5" />
              ) : (
                <MessageSquare className="w-5.5 h-5.5" />
              )}
            </button>
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">
              {callType === 'peer' ? 'Video' : 'Text'}
            </span>
          </div>

          {/* END CALL BUTTON (Enlarged) */}
          <button
            id="control-hangup"
            onClick={onHangup}
            className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center text-white shadow-[0_0_30px_rgba(239,68,68,0.35)] hover:bg-red-600 hover:scale-105 active:scale-95 transform transition-all cursor-pointer"
            title="Hang Up and Terminate Line"
          >
            <PhoneOff className="w-9 h-9 fill-current" />
          </button>

          {/* Camera flip or keyboard toggle */}
          <div className="flex flex-col items-center gap-2.5">
            <button
              id="control-flip"
              onClick={callType === 'peer' ? onFlipCamera : () => setShowChat(!showChat)}
              className={`w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-white hover:bg-slate-700 cursor-pointer ${
                callType === 'peer' && videoMuted ? 'opacity-40 cursor-not-allowed' : ''
              }`}
              disabled={callType === 'peer' && videoMuted}
              title={callType === 'peer' ? "Flip Facing Camera" : "Toggle Keyboard Overlay"}
            >
              {callType === 'peer' ? (
                <RotateCw className="w-5.5 h-5.5" />
              ) : (
                <MessageSquare className="w-5.5 h-5.5" />
              )}
            </button>
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">
              {callType === 'peer' ? 'Flip' : 'Keyboard'}
            </span>
          </div>

          {/* Speaker Info indicator */}
          <div className="flex flex-col items-center gap-2.5 opacity-90">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
              <span className="text-xs font-semibold uppercase font-mono tracking-tighter">HD</span>
            </div>
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Speaker</span>
          </div>

        </div>
      </div>
    </div>
  );
};
