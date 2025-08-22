import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';

dotenv.config();

const app = express();
const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!PUBLIC_KEY || !GROQ_API_KEY) {
  console.error("Missing DISCORD_PUBLIC_KEY or GROQ_API_KEY");
  process.exit(1);
}

// Capture raw body for signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Middleware to verify Discord signature
function verifyDiscordRequest(req, res, next) {
  const signature = req.get('X-Signature-Ed25519');
  const timestamp = req.get('X-Signature-Timestamp');
  const body = req.rawBody;

  try {
    const isValid = verifyKey(body, signature, timestamp, PUBLIC_KEY);
    if (!isValid) {
      return res.status(401).send('Bad request signature');
    }
    next(); // ✅ proceed if valid
  } catch (err) {
    console.error("Signature verification failed:", err);
    return res.status(401).send('Invalid request signature');
  }
}

// ✅ Must include leading slash
app.post('/api/interactions', verifyDiscordRequest, async (req, res) => {
  const { type, data } = req.body;

  // 1) PING = handshake
  if (type === InteractionType.PING) {
    return res.json({ type: InteractionResponseType.PONG });
  }

  // 2) Slash command: /chat
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name, options } = data;

    if (name === 'chat') {
      const prompt = options?.[0]?.value;

      try {
        const groqResponse = await fetch('https://api.groq.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "mixtral-8x7b-32768",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1024,
          }),
        });

        if (!groqResponse.ok) {
          return res.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: `Groq API Error: ${groqResponse.status} ${groqResponse.statusText}` }
          });
        }

        const groqData = await groqResponse.json();
        const reply = groqData?.choices?.[0]?.message?.content || "No reply from Groq API.";

        return res.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: reply },
        });

      } catch (err) {
        return res.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: `Error calling Groq API: ${err.message}` }
        });
      }
    }

    return res.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "Unknown command." }
    });
  }

  return res.status(400).json({ error: "Unknown interaction type" });
});

// Vercel-style export
export default app;
