// register-commands.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const APPLICATION_ID = process.env.DISCORD_CLIENT_ID;
const BOT_TOKEN = process.env.BOT_TOKEN; // Your bot token with applications.commands scope

async function registerGlobalCommand() {
  const commandData = {
    name: 'chat',
    description: 'Chat with AI',
    type: 1, // slash command
    dm_permission: true, // allow in DMs
    options: [
      {
        type: 3, // STRING
        name: 'prompt',
        description: 'Your message',
        required: true,
      },
    ],
  };

  const res = await fetch(`https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commandData),
  });

  const result = await res.json();
  console.log('Global slash command registered:', result);
}

registerGlobalCommand().catch(console.error);
