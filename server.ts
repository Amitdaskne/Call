import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy load Gemini API
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined in environment secrets. AI Calling feature will use a server-fallback response.");
      return null;
    }
    try {
      ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    } catch (e) {
      console.error("Failed to initialize GoogleGenAI client:", e);
      return null;
    }
  }
  return ai;
}

// Memory rooms for WebRTC Signaling SSE
interface SSEClient {
  peerId: string;
  res: any;
}

interface Room {
  id: string;
  peers: string[];
  clients: SSEClient[];
}

const rooms: Record<string, Room> = {};

// 1. WebRTC Signaling: SSE Stream Endpoint
app.get('/api/room/:roomId/events', (req, res) => {
  const { roomId } = req.params;
  const peerId = req.query.peerId as string;

  if (!peerId) {
    res.status(400).json({ error: "peerId query parameter required" });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Prevent Nginx buffering in Cloud Run / proxy
  });

  // Keepconnection alive with continuous commentary
  res.write(': sse connection established\n\n');

  const keepAliveInterval = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 10000);

  if (!rooms[roomId]) {
    rooms[roomId] = { id: roomId, peers: [], clients: [] };
  }

  const room = rooms[roomId];

  // Store client connection
  const existingClientIdx = room.clients.findIndex(c => c.peerId === peerId);
  if (existingClientIdx !== -1) {
    room.clients[existingClientIdx].res = res;
  } else {
    room.clients.push({ peerId, res });
  }

  if (!room.peers.includes(peerId)) {
    room.peers.push(peerId);
  }

  // Broadcast immediate join event to other peers in room
  room.clients.forEach(client => {
    if (client.peerId !== peerId) {
      try {
        client.res.write(`data: ${JSON.stringify({
          from: 'system',
          message: { type: 'joined', peerId }
        })}\n\n`);
      } catch (err) {
        console.error("Error writing to client SSE:", err);
      }
    }
  });

  // Cleanup on close
  req.on('close', () => {
    clearInterval(keepAliveInterval);
    const activeRoom = rooms[roomId];
    if (activeRoom) {
      activeRoom.clients = activeRoom.clients.filter(c => c.peerId !== peerId);
      activeRoom.peers = activeRoom.peers.filter(p => p !== peerId);
      
      // Notify remainder peers that we disconnected
      activeRoom.clients.forEach(client => {
        try {
          client.res.write(`data: ${JSON.stringify({
            from: 'system',
            message: { type: 'peer-left', peerId }
          })}\n\n`);
        } catch (err) {
          console.error("Error notifying disconnect:", err);
        }
      });

      // Cleanup room memory if vacant
      if (activeRoom.peers.length === 0) {
        delete rooms[roomId];
      }
    }
  });
});

// 2. WebRTC Signaling: Join Room
app.post('/api/room/:roomId/join', (req, res) => {
  const { roomId } = req.params;
  const { peerId } = req.body;

  if (!peerId) {
    res.status(400).json({ error: "peerId is required" });
    return;
  }

  if (!rooms[roomId]) {
    rooms[roomId] = { id: roomId, peers: [], clients: [] };
  }

  const room = rooms[roomId];
  if (!room.peers.includes(peerId)) {
    room.peers.push(peerId);
  }

  const otherPeers = room.peers.filter(id => id !== peerId);
  res.json({ success: true, otherPeers });
});

// 3. WebRTC Signaling: Exchange signaling SDP / Mute messages
app.post('/api/room/:roomId/message', (req, res) => {
  const { roomId } = req.params;
  const { from, target, message } = req.body;

  const room = rooms[roomId];
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  let count = 0;
  room.clients.forEach(client => {
    if (client.peerId !== from && (!target || client.peerId === target)) {
      try {
        client.res.write(`data: ${JSON.stringify({ from, message })}\n\n`);
        count++;
      } catch (e) {
        console.error("Failed sending signaling frame to peer:", client.peerId);
      }
    }
  });

  res.json({ success: true, deliveredCount: count });
});

// 4. Gemini AI Companion Endpoint
const PERSONA_PROMPTS: Record<string, string> = {
  cody: "You are Cody, an enthusiastic, friendly, and warm conversational cell companion. Act like you are chatting on an actual high-quality VoIP line. Keep responses extremely natural, spoken-sounding, and brief (maximum 1 to 2 short sentences). No markdown styling, lists, or headings. Keep answers focused entirely on interactive cellular call flow. Be a great chat partner!",
  zoe: "You are Zoe, a gentle mindfulness guide. You offer a soothing dial-in zen advisor line. Speak in reassuring, slow, and relaxing sentences. Maximum 2 short sentences. Encourage deep breathing and calm. No markup or lists.",
  leo: "You are Leo, a funny and passionate life coach motivation line. Give highly punchy, inspiring, or playful motivational advice. Speak directly, keep responses conversational and short (max 2 sentences) to be optimal for audio talk. Be full of bright energy!",
  marvin: "You are Marvin, a highly conversational sarcastic robot voice assistant answering a hotline. You are witty, ironical, and slightly cynical but charmingly helpful. Answer in dry, brief (max 1-2 phrases) British style."
};

app.post('/api/ai/call', async (req, res) => {
  const { prompt, persona, history = [] } = req.body;

  if (!prompt) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }

  const client = getGeminiClient();
  const selectedPersona = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.cody;

  if (!client) {
    // Elegant fallback simulation if API key is missing
    const simulatedAnswers: Record<string, string[]> = {
      zoe: ["Take a deep breath in through your nose... and let it go. You're doing splendidly.", "Remember to release the tension in your shoulders.", "All of your tasks can wait right now. Just listen to the rhythm of this call."],
      leo: ["You are absolutely killing it today! Let's conquer whatever is in front of us!", "Success doesn't wait for anyone, let's make this day legendary!", "Believe in yourself, champ! I'm cheering you on from this side of the line!"],
      marvin: ["Oh, how thrilling that you've called me. I was waiting for exactly this level of excitement.", "My brain is the size of a planet, yet here I am on a phone call with you. Fantastic.", "Yes, yes. Life is full of wonders. What other earthling inquiries do you have for me?"],
      cody: ["Hey! I'm so glad we connected on this call. What's on your mind today?", "Oh really? Decent! Tell me more about that.", "Haha, that's wild! This live cell app is working flawlessly anyway!"]
    };

    const answersList = simulatedAnswers[persona] || simulatedAnswers.cody;
    const randomIndex = Math.floor(Math.random() * answersList.length);
    const mockReply = answersList[randomIndex];

    // Simulate slightly delayed server response
    setTimeout(() => {
      res.json({ response: mockReply, source: "mock-offline" });
    }, 1200);
    return;
  }

  try {
    // Format conversation history into contents array for Gemini API SDK
    // System instruction is placed in the model settings config block
    const formattedContents: any[] = [];
    
    // Add past chat history (up to last 10 exchanges for stability)
    const recentHistory = history.slice(-10);
    recentHistory.forEach((msg: any) => {
      formattedContents.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      });
    });

    // Add current prompt
    formattedContents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    const geminiRes = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: selectedPersona,
        temperature: 0.9,
        topP: 0.95
      }
    });

    const speechText = geminiRes.text || "I'm sorry, my cellular connection fluctuated. Can you say that again?";
    res.json({ response: speechText, source: "gemini-api" });

  } catch (error: any) {
    console.error("Gemini AI Companion generation error:", error);
    res.status(500).json({ error: "Our internal carrier experienced an outage. Please speak again shortly!" });
  }
});

// Setup Vite and Static Assets
async function startApp() {
  if (process.env.NODE_ENV !== "production") {
    // Integrated Vite dev server mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    // Production serving of static files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-Stack Live Caller App running on http://localhost:${PORT}`);
  });
}

startApp().catch(e => {
  console.error("System boot up failure:", e);
});
