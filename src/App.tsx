/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Wifi, Battery, Signal, Phone, Sparkles, BookOpen, Clock, Copy, Check, ExternalLink, HelpCircle 
} from 'lucide-react';
import { DialerPad } from './components/DialerPad';
import { ContactsTab, AI_CONTACTS } from './components/ContactsTab';
import { CallScreen } from './components/CallScreen';
import { PhoneContact, AIRecord } from './types';

// Speech recognition utility
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function App() {
  // Navigation & User Input state
  const [activeTab, setActiveTab] = useState<'dialer' | 'contacts'>('dialer');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [systemTime, setSystemTime] = useState('');
  const [myPeerId] = useState(() => 'peer_' + Math.floor(Math.random() * 1000));
  
  // Call Session States
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'ringing' | 'connected' | 'ended' | 'failed'>('idle');
  const [callType, setCallType] = useState<'peer' | 'ai'>('peer');
  const [activeContact, setActiveContact] = useState<PhoneContact | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');

  // Media streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // AI voice conversation logs
  const [aiTranscript, setAiTranscript] = useState<AIRecord[]>([]);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);

  // Connection & WebRTC signaling variables
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const sseSourceRef = useRef<EventSource | null>(null);
  const micRecognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const durationTimerRef = useRef<any>(null);

  // Update dynamic clock in Status bar
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Autofill Room ID from shareable URL parameter (?room=xxx-xxx) on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setInputRoomCode(roomParam);
      setActiveTab('dialer');
      // Gentle delayed beep to signal prefilled dial
      setTimeout(() => {
        playOscillatorTone(440, 0.15);
      }, 800);
    }
  }, []);

  // Track call duration timer
  useEffect(() => {
    if (callStatus === 'connected') {
      durationTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      if (callStatus === 'idle') {
        setCallDuration(0);
      }
    }
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [callStatus]);

  // Audio helper of raw sine waves for sound effects (dialing ring, connection beep, etc.)
  const playOscillatorTone = (frequency: number, durationSeconds: number, type: OscillatorType = 'sine') => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = type;
      osc.frequency.value = frequency;

      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSeconds);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationSeconds);
    } catch (e) {
      console.warn("Speech/Tone sound failed context load:", e);
    }
  };

  // Play cellular phone Ringback sound pattern (beep.. pause.. beep)
  const playRingbackRing = () => {
    playOscillatorTone(425, 0.5);
    setTimeout(() => {
      playOscillatorTone(425, 0.5);
    }, 150);
  };

  // Ensure WebRTC peer connection configuration (free Google STUN servers)
  const getRTCConfig = (): RTCConfiguration => {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };
  };

  // --- HANG UP / TERMINATE CALL ---
  const handleHangup = (statusReset: 'idle' | 'ended' = 'idle') => {
    // 1. Play cellular disconnect audio sound
    playOscillatorTone(250, 0.45, 'sawtooth');

    // 2. Clear WebRTC tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);

    // 3. Close RTCPeerConnection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // 4. Terminate SSE client signaling stream
    if (sseSourceRef.current) {
      sseSourceRef.current.close();
      sseSourceRef.current = null;
    }

    // 5. Deactivate mic speech recognition listeners
    stopAICompanionRecognition();

    // 6. Stop TTS speech synthesis output if speaking
    try {
      window.speechSynthesis.cancel();
    } catch {}

    setCallStatus(statusReset);
    setAiSpeaking(false);
    setAiThinking(false);
  };

  // --- WEBRTC SIGNALING & CONNECTIONS ---
  const startP2PWebRTCPeerCall = async (isWithVideo: boolean) => {
    if (!inputRoomCode) return;
    const room = inputRoomCode.trim().toLowerCase();

    setCallStatus('dialing');
    setCallType('peer');
    setActiveContact({
      id: 'p2p-caller',
      name: `Room: ${room}`,
      role: isWithVideo ? 'WebRTC HD Video Call' : 'WebRTC Voice Call',
      avatarColor: 'from-sky-400 to-sky-600',
      statusText: 'Connecting secure peer stream...',
      isAi: false
    });

    // 1. Force microphone / camera video hardware access
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isWithVideo ? { facingMode: cameraFacing } : false
      });
      setLocalStream(media);
      setVideoMuted(!isWithVideo);
    } catch (err: any) {
      console.error("Camera/Mic device permission block:", err);
      // Fallback: request mic only if video block
      try {
        media = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setLocalStream(media);
        setVideoMuted(true);
      } catch (e) {
        alert("Unable to access audio/microphone input. P2P WebRTC calls require mic permissions! Please check settings.");
        setCallStatus('idle');
        return;
      }
    }

    playRingbackRing();

    // 2. Start EventSource server SSE subscription
    const sse = new EventSource(`/api/room/${room}/events?peerId=${myPeerId}`);
    sseSourceRef.current = sse;

    // Listen on SSE signaling channels
    sse.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.from === 'system') {
          // System announcements: Peer joined or left!
          if (msg.message.type === 'joined') {
            setCallStatus('ringing');
            playOscillatorTone(600, 0.2); // Connected sound beep
            // Initiate actual WebRTC P2P exchange Offer
            initiateRTCOffer(room, msg.message.peerId, media);
          } else if (msg.message.type === 'peer-left') {
            handleHangup('idle');
            alert("The distant peer disconnected from the room.");
          }
        } else {
          // Direct SDP framing from another peer
          if (msg.message.type === 'offer') {
            setCallStatus('connected');
            await handleRTCOffer(room, msg.from, msg.message.sdp, media);
          } else if (msg.message.type === 'answer') {
            setCallStatus('connected');
            await handleRTCAnswer(msg.message.sdp);
          } else if (msg.message.type === 'ice-candidate') {
            if (peerConnectionRef.current) {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(msg.message.candidate));
            }
          } else if (msg.message.type === 'mute-state') {
            // Optionally store peer mute indicator states in client
          }
        }
      } catch (err) {
        console.error("Failed to parse SSE event packet:", err);
      }
    };

    // 3. Register our presence on the signaling registry map
    try {
      const joinRes = await fetch(`/api/room/${room}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: myPeerId })
      });
      const data = await joinRes.json();
      
      // If other peers are already present in this room space, trigger early calling Dial Offer
      if (data.otherPeers && data.otherPeers.length > 0) {
        setCallStatus('connected');
        // Initiate connection directly to first peer
        initiateRTCOffer(room, data.otherPeers[0], media);
      }
    } catch (e) {
      console.error("Database join signaling call fail:", e);
      setCallStatus('failed');
    }
  };

  // Create & post the SDP Offer to target peer
  const initiateRTCOffer = async (roomCode: string, targetPeerId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection(getRTCConfig());
    peerConnectionRef.current = pc;

    // Attach local media tracks
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Handle candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingMessage(roomCode, myPeerId, targetPeerId, {
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    // Handle distant tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendSignalingMessage(roomCode, myPeerId, targetPeerId, {
        type: 'offer',
        sdp: offer
      });
    } catch (err) {
      console.error("Failed creating RTC offer:", err);
    }
  };

  // Answer an incoming SDP Offer
  const handleRTCOffer = async (roomCode: string, senderPeerId: string, sdp: RTCSessionDescriptionInit, stream: MediaStream) => {
    const pc = new RTCPeerConnection(getRTCConfig());
    peerConnectionRef.current = pc;

    // Attach local tracks
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingMessage(roomCode, myPeerId, senderPeerId, {
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignalingMessage(roomCode, myPeerId, senderPeerId, {
        type: 'answer',
        sdp: answer
      });
    } catch (err) {
      console.error("Failed answering RTC sdp offer:", err);
    }
  };

  // Complete peer handshake by applying the remote answer sdp
  const handleRTCAnswer = async (sdp: RTCSessionDescriptionInit) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    } catch (err) {
      console.error("Failed applying final remote sdp answer:", err);
    }
  };

  // Utility to POST signaling messages
  const sendSignalingMessage = async (roomCode: string, fromId: string, targetId: string, payload: any) => {
    try {
      await fetch(`/api/room/${roomCode}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromId,
          target: targetId,
          message: payload
        })
      });
    } catch (e) {
      console.error("POST message signaling delivery fail", e);
    }
  };

  // --- GEMINI AI VOICE COMPANION HOTLINE CALLS ---
  const startAICompanionCall = (contact: PhoneContact) => {
    setCallType('ai');
    setActiveContact(contact);
    setCallStatus('dialing');
    setAiTranscript([]);
    setAiSpeaking(false);
    setAiThinking(false);

    // Simulate standard cellular dials
    playOscillatorTone(350, 0.4);
    
    setTimeout(() => {
      playRingbackRing();
    }, 600);

    setTimeout(() => {
      // Connect AI companion call!
      setCallStatus('connected');
      playOscillatorTone(650, 0.25); // Pickup sound beep

      // Synthesize introductory friendly greeting based on caller profile!
      const greetings: Record<string, string> = {
        zoe: "Welcome to Zoe's Zen Advisor Dial-In. Take a deep breath... block out the noise of your screen. How can we make you feel calm today?",
        leo: "Hey champ! Leo here! I am absolutely pumped that you dialed me up. Let's make this call count, what massive goal are we conquering?",
        marvin: "Oh, terrific. Another human calling me. Marvin here. What remarkably simple query do you have for my planet-sized brain?",
        cody: "Hey! Cody here, glad you called! I was just chilling out. What are you up to today?"
      };

      const introText = greetings[contact.aiPersona || 'cody'];
      addAILogMessage('ai', introText);
      synthesizeAIVoiceOutput(introText, contact.aiPersona || 'cody');
    }, 1800);
  };

  // Text-To-Speech Speech Synthesis engine
  const synthesizeAIVoiceOutput = (text: string, personaKey: string) => {
    try {
      window.speechSynthesis.cancel(); // Cleat previous queues

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';

      // Custom speech pitch, rate, and voice attributes matching character personalities!
      if (personaKey === 'zoe') {
        utterance.rate = 0.82;
        utterance.pitch = 1.05;
      } else if (personaKey === 'leo') {
        utterance.rate = 1.15;
        utterance.pitch = 0.95;
      } else if (personaKey === 'marvin') {
        utterance.rate = 0.92;
        utterance.pitch = 0.8;
      } else {
        utterance.rate = 1.0;
        utterance.pitch = 1.05;
      }

      // Sync waveform visualizer with start/end of speak output!
      utterance.onstart = () => {
        setAiSpeaking(true);
        stopAICompanionRecognition(); // Silence mic so robot does not listen to itself
      };

      utterance.onend = () => {
        setAiSpeaking(false);
        // Restart microphone so hands-free conversational dial continues!
        startAICompanionRecognition(personaKey);
      };

      utterance.onerror = (e) => {
        console.error("SpeechSynthesis error:", e);
        setAiSpeaking(false);
        startAICompanionRecognition(personaKey);
      };

      // Retrieve default voices list and assign
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Prefer rich voice selectors
        if (personaKey === 'marvin') {
          // Marvin British accent
          const googleUK = voices.find(v => v.lang.includes('en-GB') || v.name.includes('UK') || v.name.includes('British'));
          if (googleUK) utterance.voice = googleUK;
        } else {
          const femaleEn = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Google US')));
          if (femaleEn && (personaKey === 'zoe' || personaKey === 'cody')) utterance.voice = femaleEn;
        }
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("TTS synthesis failed or blocked by frame sandbox:", e);
      setAiSpeaking(false);
    }
  };

  // Setup handsfree dictation microphone recognition loop
  const startAICompanionRecognition = (personaKey: string) => {
    if (!SpeechRecognition || callStatus !== 'connected') return;

    try {
      if (micRecognitionRef.current) {
        micRecognitionRef.current.abort();
      }

      const rec = new SpeechRecognition();
      micRecognitionRef.current = rec;

      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        console.log("Speech recognition listener active.");
      };

      rec.onresult = (event: any) => {
        const transcriptText = event.results[0][0].transcript;
        if (transcriptText && transcriptText.trim()) {
          handleAIVoiceQuery(transcriptText.trim(), personaKey);
        }
      };

      rec.onerror = (e: any) => {
        // Fail silently - user can utilize manual text overlay inputs
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn("Speech recognition error hook:", e.error);
        }
      };

      rec.onend = () => {
        // Automatically restart speech loop ONLY if AI is not speaking and call still connected
        if (callStatus === 'connected' && callType === 'ai' && !aiSpeaking && !aiThinking) {
          try {
            rec.start();
          } catch {}
        }
      };

      rec.start();
    } catch (e) {
      console.warn("Microphone speech recognition initialization failed:", e);
    }
  };

  const stopAICompanionRecognition = () => {
    if (micRecognitionRef.current) {
      try {
        micRecognitionRef.current.abort();
      } catch {}
      micRecognitionRef.current = null;
    }
  };

  // Send speech prompt to full-stack Gemini API endpoint
  const handleAIVoiceQuery = async (promptText: string, personaKey: string) => {
    if (!promptText || aiThinking) return;

    // Log user statement immediately to subtitled live caption
    addAILogMessage('user', promptText);
    setAiThinking(true);
    stopAICompanionRecognition(); // Mute mic while fetching

    try {
      const response = await fetch('/api/ai/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          persona: personaKey,
          history: aiTranscript
        })
      });

      const data = await response.json();
      setAiThinking(false);

      if (data.response) {
        addAILogMessage('ai', data.response);
        synthesizeAIVoiceOutput(data.response, personaKey);
      } else {
        const fallbackText = "Our frequency bandwidth experienced a temporary drop. Do you mind speaking that once more?";
        addAILogMessage('ai', fallbackText);
        synthesizeAIVoiceOutput(fallbackText, personaKey);
      }
    } catch (err) {
      console.error("Gemini companion fetch outline fail:", err);
      setAiThinking(false);
      const errText = "Carrier issue. The connection was lost for a second. Say that again?";
      addAILogMessage('ai', errText);
      synthesizeAIVoiceOutput(errText, personaKey);
    }
  };

  const addAILogMessage = (sender: 'user' | 'ai', msg: string) => {
    setAiTranscript(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        text: msg,
        sender,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Handles manual text box entries inside simulated handset
  const handleSendTextMessage = (text: string) => {
    if (activeContact && activeContact.aiPersona) {
      handleAIVoiceQuery(text, activeContact.aiPersona);
    }
  };

  // --- COMPONENT HANDLER INTERACTION HOOKS ---
  const handleDialContact = (contact: PhoneContact) => {
    playOscillatorTone(520, 0.15); // dialing sound tone
    if (contact.isAi) {
      startAICompanionCall(contact);
    } else {
      // Create a nice prefilled 6-digit room code for dialing a human contact
      const code = Math.floor(100100 + Math.random() * 899000).toString();
      const formatted = code.slice(0, 3) + '-' + code.slice(3);
      setInputRoomCode(formatted);
      setActiveTab('dialer');
      playOscillatorTone(580, 0.22);
    }
  };

  // Flip Camera Direction (switches front/rear camera in WebRTC)
  const handleFlipCamera = async () => {
    if (callType !== 'peer' || !localStream) return;
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);

    // Stop current track
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.stop();
    }

    try {
      const newMedia = await navigator.mediaDevices.getUserMedia({
        audio: !audioMuted,
        video: { facingMode: nextFacing }
      });
      
      const newVideoTrack = newMedia.getVideoTracks()[0];
      if (newVideoTrack && peerConnectionRef.current) {
        // Swap track in RTCPeerConnection sender
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        }
        
        // Update local stream state
        const updatedStream = new MediaStream([
          ...localStream.getAudioTracks(),
          newVideoTrack
        ]);
        setLocalStream(updatedStream);
      }
    } catch (e) {
      console.error("Camera flip operation fail:", e);
    }
  };

  // Mute microphone
  const handleToggleMute = () => {
    const nextMute = !audioMuted;
    setAudioMuted(nextMute);
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !nextMute);
    }
    // Sync with remote peer over signaling channels
    if (callType === 'peer' && inputRoomCode) {
      sendSignalingMessage(inputRoomCode.trim().toLowerCase(), myPeerId, '', {
        type: 'mute-state',
        audioMuted: nextMute,
        videoMuted
      });
    }
    playOscillatorTone(nextMute ? 300 : 600, 0.1);
  };

  // Enable/disable webcam
  const handleToggleVideo = () => {
    const nextVideoMute = !videoMuted;
    setVideoMuted(nextVideoMute);
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !nextVideoMute);
    }
    if (callType === 'peer' && inputRoomCode) {
      sendSignalingMessage(inputRoomCode.trim().toLowerCase(), myPeerId, '', {
        type: 'mute-state',
        audioMuted,
        videoMuted: nextVideoMute
      });
    }
    playOscillatorTone(nextVideoMute ? 350 : 700, 0.1);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-2 sm:p-4 text-slate-100 overflow-x-hidden font-sans select-none">
      
      {/* Dynamic Minimalist Background Halos */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-slate-900/10 blur-[130px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full bg-slate-800/5 blur-[150px] animate-pulse" style={{ animationDuration: '14s' }} />
      </div>

      <div className="relative z-10 w-full max-w-[430px] flex flex-col items-center">
        
        {/* PHYSICAL SMARTPHONE CHASSIS FRAME */}
        <div className="w-full aspect-[9/19.5] max-h-[880px] bg-slate-900 rounded-[52px] p-3.5 shadow-[0_25px_60px_-15px_rgba(0,0,0,1)] border-4 border-slate-800/80 flex flex-col overflow-hidden relative">
          
          {/* Handset notch (Clean, sleek look) */}
          <div className="absolute top-5 left-1/2 transform -translate-x-1/2 w-28 h-6 bg-slate-950 rounded-full z-45 flex items-center justify-center px-2 border border-slate-800/40">
            <div className="w-2 h-2 rounded-full bg-slate-900 border border-slate-850 ml-auto shrink-0" />
            <div className="w-1 h-1 rounded-full bg-emerald-500 opacity-80 animate-pulse ml-1.5 shrink-0" />
          </div>

          {/* SCREEN DISPLAY ACCENTS */}
          <div className="w-full h-full rounded-[38px] bg-slate-950 relative overflow-hidden flex flex-col border border-slate-950">
            
            {/* INCOMING / ACTIVE CELLULAR SCREEN OVERLAY */}
            {callStatus !== 'idle' ? (
              <CallScreen
                status={callStatus}
                callType={callType}
                contact={activeContact}
                roomId={inputRoomCode}
                duration={callDuration}
                localStream={localStream}
                remoteStream={remoteStream}
                audioMuted={audioMuted}
                videoMuted={videoMuted}
                cameraFacing={cameraFacing}
                aiTranscript={aiTranscript}
                aiSpeaking={aiSpeaking}
                aiThinking={aiThinking}
                onToggleMute={handleToggleMute}
                onToggleVideo={handleToggleVideo}
                onFlipCamera={handleFlipCamera}
                onHangup={() => handleHangup('idle')}
                onSendTextMessage={handleSendTextMessage}
              />
            ) : (
              // GENERAL PHONE CARRIER HOME SCREEN UI
              <div className="flex-1 flex flex-col justify-between h-full">
                
                {/* STATUS BAR */}
                <header className="pt-2 px-5 pb-1 flex items-center justify-between shrink-0 select-none z-20 text-[10px] font-medium text-slate-400">
                  <span className="font-sans leading-none tracking-wider font-semibold">{systemTime || '11:11'}</span>
                  <div className="flex items-center gap-1.5">
                    <Signal className="w-3.5 h-3.5 text-slate-450 fill-current" />
                    <span className="text-[8px] leading-none uppercase tracking-widest font-extrabold text-slate-400">5G</span>
                    <Wifi className="w-3.5 h-3.5 text-slate-455 fill-current" />
                    <Battery className="w-4 h-4 text-slate-450 fill-current" />
                  </div>
                </header>

                {/* APP MAIN CONTENT WORKSPACE PANEL */}
                <main className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar flex flex-col">
                  
                  {/* Carrier branding header */}
                  <div className="text-center mt-3 mb-6 select-none shrink-0">
                    <h1 className="text-lg font-light tracking-widest uppercase text-slate-100 flex items-center justify-center gap-2">
                      <span className="p-1 rounded-full bg-slate-800 text-slate-100 border border-slate-700/50">
                        <Phone className="w-3.5 h-3.5 fill-current" />
                      </span>
                      Secure Line
                    </h1>
                    <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest mt-1.5">Cryptographic Signal Active</p>
                  </div>

                  {/* ACTIVE TAB VIEWS */}
                  {activeTab === 'dialer' ? (
                    <div className="flex-1 flex flex-col justify-center">
                      <DialerPad
                        inputValue={inputRoomCode}
                        onChange={setInputRoomCode}
                        onInitiateCall={(type, id) => {
                          if (type === 'ai') {
                            const foundAI = AI_CONTACTS.find(c => c.aiPersona === id) || AI_CONTACTS[0];
                            startAICompanionCall(foundAI);
                          } else {
                            startP2PWebRTCPeerCall(false); // Audio-only signature call
                          }
                        }}
                        onInitiateVideoCall={() => startP2PWebRTCPeerCall(true)} // Video WebRTC Call
                      />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <ContactsTab onDialContact={handleDialContact} />
                    </div>
                  )}
                </main>

                {/* BOTTOM NAVIGATION TABS */}
                <nav className="border-t border-slate-900/90 bg-slate-950/90 backdrop-blur-md py-3 px-6 flex items-center justify-around shrink-0 z-20">
                  <button
                    id="tab-dialer"
                    onClick={() => {
                      setActiveTab('dialer');
                      playOscillatorTone(200, 0.08);
                    }}
                    className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                      activeTab === 'dialer' 
                        ? 'text-slate-100 font-medium scale-102' 
                        : 'text-slate-500 hover:text-slate-400'
                    }`}
                  >
                    <Phone className="w-4.5 h-4.5 fill-current animate-fade-in" />
                    <span className="text-[9px] uppercase tracking-widest font-semibold mt-0.5">Keypad</span>
                  </button>

                  <button
                    id="tab-contacts"
                    onClick={() => {
                      setActiveTab('contacts');
                      playOscillatorTone(220, 0.08);
                    }}
                    className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                      activeTab === 'contacts' 
                        ? 'text-slate-100 font-medium scale-102' 
                        : 'text-slate-500 hover:text-slate-400'
                    }`}
                  >
                    <BookOpen className="w-4.5 h-4.5 fill-current animate-fade-in" />
                    <span className="text-[9px] uppercase tracking-widest font-semibold mt-0.5">Hotlines</span>
                  </button>
                </nav>
              </div>
            )}
          </div>
        </div>

        {/* EXTERNAL OUT-OF-FRAME INFORMATION SLATE OR DECK */}
        <div className="w-full mt-4 select-text text-slate-500 text-[10px] uppercase tracking-wider flex flex-col items-center gap-2.5 text-center px-4 leading-relaxed">
          <div className="inline-flex items-center gap-1.5 bg-slate-905 border border-slate-900 px-3 py-1.5 rounded-full select-all font-mono text-[9px] text-slate-450 tracking-normal">
            <span>Client Certificate ID: {myPeerId}</span>
          </div>
          <p className="max-w-xs text-[9px]">
            To place peer-to-peer webRTC audio or video streams, load this application page in another browser tab, dial identical codes on both devices, and initiate connect.
          </p>
        </div>
      </div>
    </div>
  );
}
