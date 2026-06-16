import React from 'react';
import { Delete, Video, Phone, Sparkles } from 'lucide-react';

interface DialerPadProps {
  inputValue: string;
  onChange: (val: string) => void;
  onInitiateCall: (type: 'peer' | 'ai', id?: string) => void;
  onInitiateVideoCall: () => void;
}

// Map key to DTMF dual frequencies for realistic dialpad sounds!
const DTMF_FREQS: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
};

export const DialerPad: React.FC<DialerPadProps> = ({
  inputValue,
  onChange,
  onInitiateCall,
  onInitiateVideoCall
}) => {
  const playDTMFTone = (key: string) => {
    try {
      const freqs = DTMF_FREQS[key];
      if (!freqs) return;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc1.frequency.value = freqs[0];
      osc2.frequency.value = freqs[1];

      osc1.type = 'sine';
      osc2.type = 'sine';

      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc1.start();
      osc2.start();

      osc1.stop(audioCtx.currentTime + 0.15);
      osc2.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // AudioContext blocked or unsupported, fail gracefully
      console.warn("DTMF AudioContext failed:", e);
    }
  };

  const handleKeyPress = (char: string) => {
    if (inputValue.length < 12) {
      const newVal = inputValue + char;
      onChange(newVal);
      playDTMFTone(char);
    }
  };

  const handleDelete = () => {
    if (inputValue.length > 0) {
      onChange(inputValue.slice(0, -1));
    }
  };

  const generateRandomRoom = () => {
    const min = 100000;
    const max = 999999;
    const randomCode = Math.floor(Math.random() * (max - min + 1) + min).toString();
    // Inject hyphens: xxx-xxx
    const formatted = randomCode.slice(0, 3) + '-' + randomCode.slice(3);
    onChange(formatted);
    
    // Play dual beep tone
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = 580;
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {}
  };

  const KEYS = [
    { num: '1', sub: '✉️' }, { num: '2', sub: 'ABC' }, { num: '3', sub: 'DEF' },
    { num: '4', sub: 'GHI' }, { num: '5', sub: 'JKL' }, { num: '6', sub: 'MNO' },
    { num: '7', sub: 'PQRS' }, { num: '8', sub: 'TUV' }, { num: '9', sub: 'WXYZ' },
    { num: '*', sub: '•' }, { num: '0', sub: '+' }, { num: '#', sub: '⌗' }
  ];

  const cleanValue = inputValue.replace(/[^\d]/g, '');
  const isValidRoomCode = cleanValue.length >= 4;

  return (
    <div className="flex flex-col items-center justify-between h-full pt-2 pb-6 max-w-sm mx-auto">
      {/* Display Number Area */}
      <div className="w-full text-center px-4 mb-4">
        {inputValue ? (
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl font-light text-slate-100 tracking-widest font-sans truncate px-2 select-all">
              {inputValue}
            </span>
            <button
              id="dialer-clear"
              onClick={handleDelete}
              className="text-slate-400 hover:text-white p-2 hover:bg-slate-800/40 rounded-full transition-all shrink-0"
              title="Delete last digit"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-500 uppercase tracking-widest font-medium select-none py-2 shrink-0">
            Enter Code or Select Contact
          </div>
        )}
      </div>

      {/* Speed Dial AI Quick Action */}
      {!inputValue && (
        <div className="w-full px-4 mb-6 shrink-0">
          <button
            id="dialer-fast-ai"
            onClick={generateRandomRoom}
            className="w-full py-3 px-4 rounded-xl border border-dashed border-slate-800 hover:border-slate-700 bg-slate-900/30 hover:bg-slate-900/60 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-400 class-pulse" />
            Generate Room Code
          </button>
        </div>
      )}

      {/* Grid Keyboard Layout */}
      <div className="grid grid-cols-3 gap-y-4 gap-x-6 mb-6 select-none max-w-[290px]">
        {KEYS.map((key) => (
          <button
            id={`keypad-${key.num}`}
            key={key.num}
            onClick={() => handleKeyPress(key.num)}
            className="w-16 h-16 rounded-full bg-slate-900/60 hover:bg-slate-800/80 active:bg-slate-700/60 border border-slate-800/50 text-slate-200 active:scale-95 flex flex-col items-center justify-center transition-all cursor-pointer"
          >
            <span className="text-2xl font-light tracking-tight leading-none">{key.num}</span>
            <span className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-wider leading-none">
              {key.sub}
            </span>
          </button>
        ))}
      </div>

      {/* Action Ring buttons */}
      <div className="flex items-center justify-center gap-6 shrink-0 mt-2">
        {/* Video Call WebRTC */}
        <button
          id="btn-dialer-video"
          onClick={onInitiateVideoCall}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer ${
            isValidRoomCode
              ? 'bg-slate-100 hover:bg-white text-slate-950 active:scale-95'
              : 'bg-slate-800/40 text-slate-600 cursor-not-allowed border border-slate-800/40'
          }`}
          disabled={!isValidRoomCode}
          title={isValidRoomCode ? "P2P WebRTC Video Call" : "Enter Room Code (min 4 digits) to make video call"}
        >
          <Video className="w-5 h-5 fill-current" />
        </button>

        {/* Voice Call WebRTC */}
        <button
          id="btn-dialer-voice"
          onClick={() => onInitiateCall('peer')}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all cursor-pointer ${
            isValidRoomCode
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-90 scale-105'
              : 'bg-slate-800/40 text-slate-600 cursor-not-allowed border border-slate-800/40'
          }`}
          disabled={!isValidRoomCode}
          title={isValidRoomCode ? "P2P WebRTC Voice Call" : "Enter Room Code (min 4 digits) to make voice call"}
        >
          <Phone className="w-6 h-6 fill-current" />
        </button>

        {/* Speed-dial Cody AI Hotline fallback */}
        <button
          id="btn-dialer-ai"
          onClick={() => onInitiateCall('ai', 'cody')}
          className="w-14 h-14 rounded-full bg-slate-900 border border-slate-850 text-slate-200 hover:bg-slate-800 hover:text-white flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer"
          title="Dial AI General Assistant"
        >
          <Sparkles className="w-5 h-5 fill-current text-white" />
        </button>
      </div>
    </div>
  );
};
