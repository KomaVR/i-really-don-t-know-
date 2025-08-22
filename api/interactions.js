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

  // 2) Slash command
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name, options } = data;
    let prompt = options?.[0]?.value || '';
    let aiPrompt = '';

    // AI-based commands
    if (name === 'chat') {
      aiPrompt = prompt;
    } else if (name === 'joke') {
      aiPrompt = prompt ? `Tell a funny joke about ${prompt}.` : 'Tell a random funny joke.';
    } else if (name === 'quote') {
      aiPrompt = prompt ? `Give an inspirational quote about ${prompt}.` : 'Give a random inspirational quote.';
    } else if (name === 'trivia') {
      aiPrompt = prompt ? `Ask a trivia question about ${prompt}.` : 'Ask a random trivia question.';
    } else if (name === 'poem') {
      aiPrompt = prompt ? `Write a short poem about ${prompt}.` : 'Write a short random poem.';
    } else if (name === 'story') {
      aiPrompt = prompt ? `Tell a short story about ${prompt}.` : 'Tell a short random story.';
    } else if (name === 'riddle') {
      aiPrompt = prompt ? `Give a riddle about ${prompt}.` : 'Give a random riddle.';
    } else if (name === 'fact') {
      aiPrompt = prompt ? `Share an interesting fact about ${prompt}.` : 'Share a random interesting fact.';
    } else if (name === 'translate') {
      aiPrompt = `Translate the following text to English: ${prompt}. If the text is already in English, translate to Spanish.`;
    } else if (name === 'summarize') {
      aiPrompt = `Summarize the following text: ${prompt}`;
    } else if (name === 'advice') {
      aiPrompt = prompt ? `Give advice on ${prompt}.` : 'Give random life advice.';
    } else if (name === 'recipe') {
      aiPrompt = prompt ? `Provide a simple recipe for ${prompt}.` : 'Provide a simple random recipe.';
    } else if (name === 'workout') {
      aiPrompt = prompt ? `Suggest a workout plan for ${prompt}.` : 'Suggest a beginner workout plan.';
    } else if (name === 'motivate') {
      aiPrompt = prompt ? `Give a motivational message about ${prompt}.` : 'Give a random motivational message.';
    } else if (name === 'pun') {
      aiPrompt = prompt ? `Make a pun about ${prompt}.` : 'Make a random pun.';
    } else if (name === 'haiku') {
      aiPrompt = prompt ? `Write a haiku about ${prompt}.` : 'Write a random haiku.';
    } else if (name === 'limerick') {
      aiPrompt = prompt ? `Write a limerick about ${prompt}.` : 'Write a random limerick.';
    } else if (name === 'horoscope') {
      aiPrompt = prompt ? `Give a daily horoscope for ${prompt} sign.` : 'Give a random daily horoscope.';
    } else if (name === 'dream') {
      aiPrompt = `Interpret the following dream: ${prompt}`;
    } else if (name === 'name') {
      aiPrompt = prompt ? `Suggest 5 names for ${prompt}.` : 'Suggest 5 random baby names.';
    } else if (name === 'idea') {
      aiPrompt = prompt ? `Give a business idea related to ${prompt}.` : 'Give a random business idea.';
    } else if (name === 'tip') {
      aiPrompt = prompt ? `Give a tip on ${prompt}.` : 'Give a random productivity tip.';
    } else if (name === 'code') {
      aiPrompt = `Generate a simple code snippet in Python for ${prompt}.`;
    } else if (name === 'explain') {
      aiPrompt = `Explain ${prompt} in simple terms.`;
    } else if (name === 'define') {
      aiPrompt = `Define the word ${prompt}.`;
    } else if (name === 'synonym') {
      aiPrompt = `Provide 5 synonyms for ${prompt}.`;
    } else if (name === 'antonym') {
      aiPrompt = `Provide 5 antonyms for ${prompt}.`;
    } else if (name === 'rhyme') {
      aiPrompt = `List 5 words that rhyme with ${prompt}.`;
    } else if (name === 'anagram') {
      aiPrompt = `Generate 5 anagrams for ${prompt}.`;
    } else if (name === 'palindrome') {
      aiPrompt = `Check if ${prompt} is a palindrome and explain.`;
    } else if (name === 'math') {
      aiPrompt = `Solve the following math problem: ${prompt}`;
    }

    if (aiPrompt) {
      try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "deepseek-r1-distill-llama-70b",
            messages: [{ role: "user", content: aiPrompt }],
            max_completion_tokens: 1024,
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
    } else {
      // Non-AI commands
      let reply = '';
      try {
        if (name === 'catfact') {
          const res = await fetch('https://catfact.ninja/fact');
          const data = await res.json();
          reply = data.fact;
        } else if (name === 'dogimage') {
          const res = await fetch('https://dog.ceo/api/breeds/image/random');
          const data = await res.json();
          reply = `Here's a random dog image: ${data.message}`;
        } else if (name === 'bored') {
          const res = await fetch('https://www.boredapi.com/api/activity');
          const data = await res.json();
          reply = data.activity;
        } else if (name === 'agify') {
          if (!prompt) {
            reply = 'Please provide a name.';
          } else {
            const res = await fetch(`https://api.agify.io?name=${encodeURIComponent(prompt)}`);
            const data = await res.json();
            reply = `Estimated age for ${data.name}: ${data.age}`;
          }
        } else if (name === 'genderize') {
          if (!prompt) {
            reply = 'Please provide a name.';
          } else {
            const res = await fetch(`https://api.genderize.io?name=${encodeURIComponent(prompt)}`);
            const data = await res.json();
            reply = `Gender for ${data.name}: ${data.gender} (probability: ${data.probability})`;
          }
        } else if (name === 'nationalize') {
          if (!prompt) {
            reply = 'Please provide a name.';
          } else {
            const res = await fetch(`https://api.nationalize.io?name=${encodeURIComponent(prompt)}`);
            const data = await res.json();
            if (data.country && data.country.length > 0) {
              reply = `Most likely nationality for ${data.name}: ${data.country[0].country_id} (probability: ${data.country[0].probability})`;
            } else {
              reply = 'No nationality data found.';
            }
          }
        } else if (name === 'randomjoke') {
          const res = await fetch('https://official-joke-api.appspot.com/random_joke');
          const data = await res.json();
          reply = `${data.setup} ... ${data.punchline}`;
        } else if (name === 'randomuser') {
          const res = await fetch('https://randomuser.me/api/');
          const data = await res.json();
          const user = data.results[0];
          reply = `Random user: ${user.name.first} ${user.name.last}, Email: ${user.email}, Location: ${user.location.city}`;
        } else if (name === 'pokemon') {
          const poke = prompt || 'pikachu';
          const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(poke.toLowerCase())}`);
          if (!res.ok) {
            reply = 'Pokemon not found.';
          } else {
            const data = await res.json();
            reply = `Pokemon: ${data.name}, Height: ${data.height} dm, Weight: ${data.weight} hg`;
          }
        } else if (name === 'numberfact') {
          const num = prompt || 'random';
          const res = await fetch(`http://numbersapi.com/${encodeURIComponent(num)}`);
          reply = await res.text();
        } else if (name === 'bitcoinprice') {
          const res = await fetch('https://api.coindesk.com/v1/bpi/currentprice.json');
          const data = await res.json();
          reply = `Bitcoin price: $${data.bpi.USD.rate}`;
        } else if (name === 'randomadvice') {
          const res = await fetch('https://api.adviceslip.com/advice');
          const data = await res.json();
          reply = data.slip.advice;
        } else if (name === 'randomquote') {
          const res = await fetch('https://zenquotes.io/api/random');
          const data = await res.json();
          const q = data[0];
          reply = `"${q.q}" - ${q.a}`;
        } else if (name === 'chucknorris') {
          const res = await fetch('https://api.chucknorris.io/jokes/random');
          const data = await res.json();
          reply = data.value;
        } else if (name === 'httpcat') {
          const code = prompt || '200';
          reply = `HTTP ${code}: ![HTTP Cat](https://http.cat/${code})`;
        } else if (name === 'randomfox') {
          const res = await fetch('https://randomfox.ca/floof/');
          const data = await res.json();
          reply = `Random fox: ${data.image}`;
        } else if (name === 'robohash') {
          const text = prompt || 'grok';
          reply = `Robohash image: https://robohash.org/${encodeURIComponent(text)}`;
        } else if (name === 'dadjoke') {
          const res = await fetch('https://icanhazdadjoke.com/', {
            headers: { 'Accept': 'application/json' }
          });
          const data = await res.json();
          reply = data.joke;
        } else if (name === 'coinflip') {
          reply = Math.random() < 0.5 ? 'Heads!' : 'Tails!';
        } else if (name === 'rolldice') {
          const sides = parseInt(prompt) || 6;
          if (isNaN(sides) || sides < 2) {
            reply = 'Invalid number of sides.';
          } else {
            const roll = Math.floor(Math.random() * sides) + 1;
            reply = `You rolled a ${roll} on a ${sides}-sided die.`;
          }
        } else if (name === 'randomnum') {
          let min = 1, max = 100;
          if (prompt) {
            const parts = prompt.split('-').map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
              min = parts[0];
              max = parts[1];
            } else {
              reply = 'Invalid range. Use format min-max.';
              throw new Error('Invalid input'); // to skip
            }
          }
          const num = Math.floor(Math.random() * (max - min + 1)) + min;
          reply = `Random number: ${num}`;
        } else if (name === 'currenttime') {
          reply = new Date().toUTCString();
        } else if (name === 'echo') {
          reply = prompt || 'Nothing to echo.';
        } else if (name === 'uppercase') {
          reply = prompt.toUpperCase() || 'Provide text to convert.';
        } else if (name === 'lowercase') {
          reply = prompt.toLowerCase() || 'Provide text to convert.';
        } else if (name === 'reverse') {
          reply = prompt.split('').reverse().join('') || 'Provide text to reverse.';
        } else if (name === 'wordcount') {
          const count = prompt ? prompt.trim().split(/\s+/).length : 0;
          reply = `Word count: ${count}`;
        } else if (name === 'charcount') {
          const count = prompt ? prompt.length : 0;
          reply = `Character count: ${count}`;
        } else if (name === 'password') {
          const len = parseInt(prompt) || 12;
          if (isNaN(len) || len < 1) {
            reply = 'Invalid length.';
          } else {
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
            let pass = '';
            for (let i = 0; i < len; i++) {
              pass += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            reply = `Generated password: ${pass}`;
          }
        } else if (name === 'qrcode') {
          if (!prompt) {
            reply = 'Provide text for QR code.';
          } else {
            reply = `QR Code: https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(prompt)}&size=200x200`;
          }
        } else if (name === 'shortenurl') {
          if (!prompt) {
            reply = 'Provide a URL to shorten.';
          } else {
            const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(prompt)}`);
            reply = `Shortened URL: ${await res.text()}`;
          }
        } else if (name === 'defineword') {
          if (!prompt) {
            reply = 'Provide a word to define.';
          } else {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(prompt)}`);
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              const def = data[0].meanings[0].definitions[0].definition;
              reply = `Definition of ${prompt}: ${def}`;
            } else {
              reply = 'Word not found.';
            }
          }
        } else if (name === 'randomcolor') {
          const res = await fetch('http://www.colourlovers.com/api/colors/random?format=json');
          const data = await res.json();
          const color = data[0];
          reply = `Random color: ${color.title} - #${color.hex}`;
        } else if (name === 'publicholidays') {
          const year = new Date().getFullYear();
          const country = prompt || 'US';
          const res = await fetch(`https://date.nager.at/api/v3/publicholidays/${year}/${encodeURIComponent(country)}`);
          if (!res.ok) {
            reply = 'Invalid country code.';
          } else {
            const data = await res.json();
            reply = data.map(h => `${h.date}: ${h.name}`).join('\n') || 'No holidays found.';
          }
        } else if (name === 'isslocation') {
          const res = await fetch('http://api.open-notify.org/iss-now.json');
          const data = await res.json();
          reply = `ISS current position: Latitude ${data.iss_position.latitude}, Longitude ${data.iss_position.longitude}`;
        } else if (name === 'weather') {
          const city = prompt || 'London';
          const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=3`);
          reply = `Weather in ${city}: ${await res.text()}`;
        } else if (name === 'randomduck') {
          const res = await fetch('https://random-d.uk/api/random');
          const data = await res.json();
          reply = `Random duck: ${data.url}`;
        } else if (name === 'picsum') {
          let [width, height] = prompt ? prompt.split('x').map(Number) : [200, 300];
          if (isNaN(width) || isNaN(height)) {
            reply = 'Invalid dimensions. Use widthxheight.';
          } else {
            reply = `Random image: https://picsum.photos/${width}/${height}`;
          }
        } else if (name === 'affirmation') {
          const res = await fetch('https://www.affirmations.dev/');
          const data = await res.json();
          reply = data.affirmation;
        } else if (name === 'ispalindrome') {
          if (!prompt) {
            reply = 'Provide text to check.';
          } else {
            const cleaned = prompt.toLowerCase().replace(/[^a-z0-9]/g, '');
            const reversed = cleaned.split('').reverse().join('');
            reply = cleaned === reversed ? `${prompt} is a palindrome.` : `${prompt} is not a palindrome.`;
          }
        } else if (name === 'factorial') {
          const n = parseInt(prompt);
          if (isNaN(n) || n < 0) {
            reply = 'Provide a non-negative integer.';
          } else {
            let fact = 1;
            for (let i = 2; i <= n; i++) fact *= i;
            reply = `Factorial of ${n} is ${fact}.`;
          }
        } else if (name === 'fibonacci') {
          const n = parseInt(prompt) || 10;
          if (isNaN(n) || n < 1) {
            reply = 'Provide a positive integer.';
          } else {
            let a = 0, b = 1, seq = [0, 1];
            for (let i = 2; i < n; i++) {
              let next = a + b;
              a = b;
              b = next;
              seq.push(next);
            }
            reply = `First ${n} Fibonacci numbers: ${seq.join(', ')}`;
          }
        } else if (name === 'isprime') {
          const n = parseInt(prompt);
          if (isNaN(n) || n < 2) {
            reply = 'Provide an integer greater than 1.';
          } else {
            let isPrime = true;
            for (let i = 2; i <= Math.sqrt(n); i++) {
              if (n % i === 0) {
                isPrime = false;
                break;
              }
            }
            reply = `${n} is ${isPrime ? '' : 'not '}a prime number.`;
          }
        } else if (name === 'binary') {
          if (!prompt) {
            reply = 'Provide text to convert.';
          } else {
            reply = prompt.split('').map(c => c.charCodeAt(0).toString(2)).join(' ');
          }
        } else if (name === 'hex') {
          if (!prompt) {
            reply = 'Provide text to convert.';
          } else {
            reply = prompt.split('').map(c => c.charCodeAt(0).toString(16)).join(' ');
          }
        } else if (name === 'pi') {
          const digits = parseInt(prompt) || 10;
          reply = Math.PI.toFixed(digits);
        } else if (name === 'e') {
          const digits = parseInt(prompt) || 10;
          reply = Math.E.toFixed(digits);
        } else if (name === 'placebear') {
          let [width, height] = prompt ? prompt.split('x').map(Number) : [200, 300];
          if (isNaN(width) || isNaN(height)) {
            reply = 'Invalid dimensions. Use widthxheight.';
          } else {
            reply = `Bear placeholder: https://placebear.com/${width}/${height}`;
          }
        } else if (name === 'randomanime') {
          const res = await fetch('https://api.jikan.moe/v4/random/anime');
          const data = await res.json();
          const anime = data.data;
          reply = `Random anime: ${anime.title} - Score: ${anime.score}`;
        } else if (name === 'ukholidays') {
          const res = await fetch('https://www.gov.uk/bank-holidays.json');
          const data = await res.json();
          const holidays = data['england-and-wales'].events.map(e => `${e.date}: ${e.title}`).join('\n');
          reply = `UK Bank Holidays (England & Wales):\n${holidays}`;
        } else {
          return res.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: "Unknown command." }
          });
        }
      } catch (err) {
        reply = `Error: ${err.message}`;
      }

      return res.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: reply || "No response." },
      });
    }
  }

  return res.status(400).json({ error: "Unknown interaction type" });
});

// Vercel-style export
export default app;
