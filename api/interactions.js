import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!PUBLIC_KEY || !GROQ_API_KEY) {
    console.error("Error: DISCORD_PUBLIC_KEY and GROQ_API_KEY environment variables must be set.");
    process.exit(1); // Exit if critical environment variables are missing
}

// Middleware to verify request signature
function verifyKey(req, res, buf, encoding) {
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];

    console.log("Signature:", signature);
    console.log("Timestamp:", timestamp);

    if (!signature || !timestamp) {
        console.log("Missing signature or timestamp headers");
        return res.status(401).send('Invalid request signature: Missing headers');
    }

    try {
        const message = Buffer.from(timestamp + buf.toString(), 'utf-8');
        const publicKey = Buffer.from(PUBLIC_KEY, 'hex');
        const signatureBuffer = Buffer.from(signature, 'hex');

        console.log("Message:", message.toString('utf-8'));
        console.log("Public Key:", publicKey.toString('hex'));
        console.log("Signature Buffer:", signatureBuffer.toString('hex'));

        const isVerified = crypto.verify(null, message, publicKey, signatureBuffer);

        console.log("Signature Verified:", isVerified);

        if (!isVerified) {
            console.log("Signature mismatch");
            return res.status(401).send('Invalid request signature: Signature mismatch');
        }
    } catch (error) {
        console.error("Signature verification error:", error);
        console.error("Error Stack:", error.stack); // Log the stack trace
        return res.status(400).send('Invalid request: Signature verification failed'); // More informative error
    }
}

app.use(express.raw({ type: 'application/json', verify: verifyKey })); // Verify signature *before* parsing JSON
//app.use(express.json({ verify: verifyKey })); // Verify signature *before* parsing JSON
app.use(express.urlencoded({ extended: true })); // Consider this if you need URL-encoded data

// Handle GET request for verification (Discord's initial handshake)
app.get('/interactions', (req, res) => {
    res.status(200).send('OK'); // Respond with 200 OK
});

// Handle POST requests for interactions
app.post('/interactions', async (req, res) => {
    const interaction = req.body;

    try {
        // PING interaction type (Discord's heartbeat)
        if (interaction.type === 1) {
            return res.json({ type: 1 }); // Respond with a PONG
        }

        // Application command interaction type (slash commands)
        if (interaction.type === 2 && interaction.data.name === 'chat') {
            const prompt = interaction.data.options[0].value;

            // Call Groq API
            try {
                const groqResponse = await fetch('https://api.groq.com/v1/chat/completions', { // Replace with the *actual* Groq API endpoint
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${GROQ_API_KEY}`,
                    },
                    body: JSON.stringify({
                        model: "mixtral-8x7b-32768", // Or the model you want to use
                        messages: [{ role: "user", content: prompt }],
                        max_tokens: 1024, // Adjust as needed
                    }),
                });

                if (!groqResponse.ok) {
                    console.error("Groq API error:", groqResponse.status, groqResponse.statusText);
                    return res.status(500).json({ type: 4, data: { content: `Groq API Error: ${groqResponse.status} ${groqResponse.statusText}` } });
                }

                const groqData = await groqResponse.json();

                const reply = groqData?.choices?.[0]?.message?.content || 'No reply from Groq API.';

                // Respond to Discord with the Groq API's reply
                return res.json({
                    type: 4, // Indicates a response to the command
                    data: {
                        content: reply,
                    },
                });

            } catch (groqError) {
                console.error("Error calling Groq API:", groqError);
                return res.status(500).json({ type: 4, data: { content: `Error calling Groq API: ${groqError.message}` } });
            }
        }

        // Unknown interaction type
        return res.status(400).send('Unknown interaction type');

    } catch (error) {
        console.error("General error handling interaction:", error);
        return res.status(500).send('Internal Server Error');
    }
});

// Export the handler function (ES Module style)
export default async (req, res) => {
    await app(req, res); // Pass the request and response to the Express app
};
