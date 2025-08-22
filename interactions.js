import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // For API calls

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Middleware to verify request signature
function verifyKey(req, res, buf, encoding) {
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];

  if (!signature || !timestamp) {
    return res.status(401).send('Invalid request signature');
  }

  const isVerified = crypto.verify(
    'sha256',
    Buffer.from(timestamp + buf.toString()),
    Buffer.from(PUBLIC_KEY, 'hex'),
    Buffer.from(signature, 'hex')
  );

  if (!isVerified) {
    return res.status(401).send('Bad request signature');
  }
}

app.use(express.json({ verify: verifyKey }));

// Handle GET request for verification
app.get('/interactions', (req, res) => {
  // Respond with 200 OK to verify the endpoint
  res.status(200).send('OK');
});

app.post('/interactions', async (req, res) => {
  const interaction = req.body;

  // PING
  if (interaction.type === 1) {
    return res.json({ type: 1 });
  }

  // Command handling
  if (interaction.type === 2 && interaction.data.name === 'chat') {
    const prompt = interaction.data.options[0].value;

    // Call Groq API with your API key
    const groqResponse = await fetch('https://api.groq.com/v1/some-endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({ prompt }),
    });

    const groqData = await groqResponse.json();

    // Respond with Groq API result
    return res.json({
      type: 4,
      data: {
        content: groqData.reply || 'No reply from Groq API.',
      },
    });
  }

  res.status(400).send('Unknown interaction');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
