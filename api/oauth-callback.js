// /api/oauth-callback.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  const code = req.query.code;
  const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI } = process.env;

  if (!code) {
    return res.status(400).send('Missing code parameter');
  }

  // Exchange code for token
  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: DISCORD_REDIRECT_URI,
    }),
  });

  const data = await response.json();

  if (data.error) {
    return res.status(400).json(data);
  }

  // You can store the token in a session, database, or just send it back
  res.json({ token: data.access_token });
}
