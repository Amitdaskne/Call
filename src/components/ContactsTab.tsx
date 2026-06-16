import React from 'react';
import { Phone, Sparkles, User, CircleDot } from 'lucide-react';
import { PhoneContact } from '../types';

interface ContactsTabProps {
  onDialContact: (contact: PhoneContact) => void;
}

export const AI_CONTACTS: PhoneContact[] = [
  {
    id: 'ai-cody',
    name: 'Cody (AI Companion)',
    role: 'Warm & Friendly Chat Partner',
    avatarColor: 'from-emerald-400 to-emerald-600',
    statusText: 'Online • Friendly',
    isAi: true,
    aiPersona: 'cody'
  },
  {
    id: 'ai-zoe',
    name: 'Zoe (Zen Teacher)',
    role: 'Mindfulness & Meditation Coach',
    avatarColor: 'from-sky-400 to-sky-600',
    statusText: 'Online • Relaxes Mind',
    isAi: true,
    aiPersona: 'zoe'
  },
  {
    id: 'ai-leo',
    name: 'Leo (Hype Coach)',
    role: 'Motivational Energy Line',
    avatarColor: 'from-amber-400 to-amber-600',
    statusText: 'Online • High Energy',
    isAi: true,
    aiPersona: 'leo'
  },
  {
    id: 'ai-marvin',
    name: 'Marvin (Cheeky AI)',
    role: 'Sarcastic Assistant Hotline',
    avatarColor: 'from-purple-400 to-purple-600',
    statusText: 'Online • Extremely Witty',
    isAi: true,
    aiPersona: 'marvin'
  }
];

const MOCK_HUMAN_CONTACTS: PhoneContact[] = [
  {
    id: 'user-amit',
    name: 'Amit Kumar',
    role: 'Remote P2P Peer',
    avatarColor: 'from-rose-400 to-rose-600',
    statusText: 'Available for WebRTC Video',
    isAi: false
  },
  {
    id: 'user-priya',
    name: 'Priya Sharma',
    role: 'Design Lead',
    avatarColor: 'from-blue-400 to-blue-600',
    statusText: 'Idle',
    isAi: false
  },
  {
    id: 'user-john',
    name: 'John Doe',
    role: 'Systems Engineer',
    avatarColor: 'from-indigo-400 to-indigo-600',
    statusText: 'Offline',
    isAi: false
  }
];

export const ContactsTab: React.FC<ContactsTabProps> = ({ onDialContact }) => {
  return (
    <div className="space-y-6">
      {/* AI Companions Hotlines */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Gemini AI Hotlines</span>
        </div>
        
        <div className="grid grid-cols-1 gap-2.5">
          {AI_CONTACTS.map((contact) => (
            <div 
              key={contact.id}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/60 hover:border-slate-700/85 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${contact.avatarColor} p-0.5 flex items-center justify-center text-white font-light text-sm shadow-md`}>
                  <div className="w-full h-full rounded-full bg-slate-950/40 backdrop-blur-sm flex items-center justify-center">
                    {contact.name.charAt(0)}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-100 group-hover:text-white transition-colors">{contact.name}</h4>
                  <p className="text-[11px] text-slate-450 mt-0.5">{contact.role}</p>
                  <p className="text-[9px] text-emerald-400 mt-1.5 flex items-center gap-1.5 uppercase tracking-widest font-semibold">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                    {contact.statusText}
                  </p>
                </div>
              </div>
              
              <button
                id={`dial-${contact.id}`}
                onClick={() => onDialContact(contact)}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-white active:scale-95 flex items-center justify-center text-slate-950 transition-all font-medium cursor-pointer"
                title={`Call ${contact.name}`}
              >
                <Phone className="w-4 h-4 fill-current text-slate-950" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Human/Invitation Contacts Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">P2P Peer Directory</span>
        </div>
        
        <div className="grid grid-cols-1 gap-2.5">
          {MOCK_HUMAN_CONTACTS.map((contact) => (
            <div 
              key={contact.id}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/50 hover:border-slate-750 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${contact.avatarColor} p-0.5 flex items-center justify-center text-white font-light text-sm`}>
                  <div className="w-full h-full rounded-full bg-slate-950/60 flex items-center justify-center">
                    {contact.name.charAt(0)}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">{contact.name}</h4>
                  <p className="text-[11px] text-slate-450 mt-0.5">{contact.role}</p>
                  <p className="text-[9px] text-slate-500 mt-1.5 flex items-center gap-1.5 uppercase tracking-widest font-semibold">
                    <CircleDot className="w-1.5 h-1.5 text-slate-500" />
                    {contact.statusText}
                  </p>
                </div>
              </div>
              
              <button
                id={`dial-${contact.id}`}
                onClick={() => onDialContact(contact)}
                className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-slate-200 transition-all cursor-pointer"
                title={`Invite and Call ${contact.name}`}
              >
                <Phone className="w-4 h-4 text-slate-305" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Help Footer note for WebRTC */}
      <div className="rounded-2xl p-4 bg-slate-900/40 border border-slate-800/80 text-[10px] tracking-wide text-slate-400 leading-relaxed uppercase">
        <span className="font-semibold text-slate-300 block mb-1">💡 What is P2P Calling?</span>
        Make direct video/voice calls instantly. Share a Room Code, and connect devices seamlessly.
      </div>
    </div>
  );
};
