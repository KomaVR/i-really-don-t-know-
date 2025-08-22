import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';

dotenv.config();

const app = express();
const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!PUBLIC_KEY || !GROQ_API_KEY) {
    console.error("Error: DISCORD_PUBLIC_KEY and GROQ_API_KEY environment variables must be set.");
    process.exit(1); // Exit if critical environment variables are missing
}

// Middleware to verify request signature
function verifyDiscordRequest(req, res) {
    const signature = req.get('X-Signature-Ed25519');
    const timestamp = req.get('X-Signature-Timestamp');
    const body = req.rawBody; // rawBody is added by express.raw() middleware

    const isValidRequest = verifyKey(body, signature, timestamp, PUBLIC_KEY);
    if (!isValidRequest) {
        return res.status(401).send('Bad request signature');
    }
}

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString(); // Store raw body for signature verification
    }
}));

// Handle GET request for verification (Discord's initial handshake)
app.get('/interactions', (req, res) => {
    console.log("GET /interactions route hit!");
    res.status(200).send('OK');
});

app.get('/api/interactions', (req, res) => {
    console.log("GET /api/interactions route hit!");
    res.status(200).send('OK');
});

// Handle POST requests for interactions
app.post('/interactions', async (req, res) => {
    console.log("POST /interactions route hit!");

    try {
        verifyDiscordRequest(req, res); // Verify the signature

        const { type, data } = req.body;

        /**
         * Handle verification requests
         */
        if (type === InteractionType.PING) {
            console.log("Received PING interaction");
            return res.json({ type: InteractionResponseType.PONG });
        }

        /**
         * Handle application command requests
         */
        if (type === InteractionType.APPLICATION_COMMAND) {
            console.log("Received APPLICATION_COMMAND interaction");
            const { name } = data;

            if (name === 'chat') {
                const prompt = data.options?.[0]?.value;
                console.log(`Received chat command with prompt: ${prompt}`);

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
                        console.error("Groq API error:", groqResponse.status, groqResponse.statusText);
                        return res.status(500).json({
                            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                            data: { content: `Groq API Error: ${groqResponse.status} ${groqResponse.statusText}` }
                        });
                    }

                    const groqData = await groqResponse.json();
                    const reply = groqData?.choices?.[0]?.message?.content || 'No reply from Groq API.';

                    return res.json({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: { content: reply },
                    });

                } catch (groqError) {
                    console.error("Error calling Groq API:", groqError);
                    return res.status(500).json({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: { content: `Error calling Groq API: ${groqError.message}` }
                    });
                }
            } else {
                console.log("Unknown command:", name);
                return res.status(400).json({ error: 'Unknown command' });
            }
        }

        /**
         * Handle other interaction types (MESSAGE_COMPONENT, MODAL_SUBMIT, etc.)
         */
        console.log("Unknown interaction type:", type);
        return res.status(400).json({ error: 'Unknown interaction type' });

    } catch (error) {
        console.error("General error handling interaction:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Export the handler function (ES Module style)
export default async (req, res) => {
    console.log("Entry point hit!");
    await app(req, res); // Pass the request and response to the Express app
};
