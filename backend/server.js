const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Supabase Client
let supabase;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('[9Router] Supabase Analytics Tracking Enabled.');
}

const allowedOrigins = [
  'https://itsfajarbudi.github.io',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:5000'
];

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests) only if they provide the valid auth token later.
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('Access blocked by CORS policy. Origin not allowed.'), false);
    }
    return callback(null, true);
  }
}));
app.use(express.json());

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs
  message: { error: { message: "Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit." } },
  standardHeaders: true,
  legacyHeaders: false,
});

// Root endpoint for friendly greeting (so it's not white screen)
app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="background-color: #0f172a; color: #3b82f6; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; flex-direction: column;">
        <h1 style="margin: 0; font-size: 3rem;">🚀 9Router Backend</h1>
        <p style="color: #94a3b8; margin-top: 10px;">API Proxy is running securely.</p>
      </body>
    </html>
  `);
});

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '9Router Server is running' });
});

// OpenAI compatible endpoint
app.post('/v1/chat/completions', apiLimiter, async (req, res) => {
  try {
    // 1. Validate Authentication
    const authHeader = req.headers.authorization;
    const validToken = process.env.ROUTER_API_KEY || 'portofolio-fajar';
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== validToken) {
      console.warn(`[9Router Security] Blocked unauthorized request from IP: ${req.ip}`);
      return res.status(401).json({ error: { message: "Unauthorized. Invalid or missing API Key." } });
    }

    const { model, messages, temperature } = req.body;
    
    console.log(`[9Router] Received request. Routing to Gemini AI...`);
    
    let apiKey = process.env.GEMINI_API_KEY;

    // Fetch key from Supabase if available (Secure DB Storage)
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('api_settings')
          .select('api_key')
          .eq('provider', 'gemini')
          .single();
        
        if (data && data.api_key) {
          apiKey = data.api_key;
        }
      } catch (dbErr) {
        console.warn(`[9Router] Could not fetch Gemini API Key from Supabase, falling back to .env`);
      }
    }

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return res.status(401).json({
        error: { message: "API Key Gemini belum dikonfigurasi di server 9Router (.env). Buka file .env dan masukkan API Key Anda, atau kirimkan via header x-gemini-api-key." }
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    let systemInstruction = "";
    let lastUserMessage = "";

    messages.forEach(msg => {
      if (msg.role === 'system') {
        systemInstruction += msg.content + " ";
      } else if (msg.role === 'user') {
        lastUserMessage = msg.content;
      }
    });

    let rawHistory = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

    // Google Gemini Strict Compliance: History MUST start with 'user' and MUST strictly alternate.
    let chatHistory = [];
    let expectedRole = 'user';

    for (const msg of rawHistory) {
      if (msg.role === expectedRole) {
        chatHistory.push(msg);
        expectedRole = expectedRole === 'user' ? 'model' : 'user';
      } else if (chatHistory.length > 0) {
        // If sequence breaks (e.g. two 'user' in a row), merge them into the previous message
        chatHistory[chatHistory.length - 1].parts[0].text += "\n\n" + msg.parts[0].text;
      }
    }

    const geminiModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction.trim() || undefined
    });

    // Remove the last message from history to send it as the prompt
    if (chatHistory.length > 0) {
      chatHistory.pop(); 
    }

    const chat = geminiModel.startChat({
      history: chatHistory,
      generationConfig: {
        temperature: temperature || 0.7,
      }
    });

    const startTime = Date.now();
    const result = await chat.sendMessage(lastUserMessage);
    const aiReply = result.response.text();
    const latency = Date.now() - startTime;

    console.log(`[9Router] Successfully received response from Gemini.`);
    
    // Log usage to Supabase
    if (supabase) {
      try {
        const usage = result.response.usageMetadata || {};
        const promptTokens = usage.promptTokenCount || 0;
        const completionTokens = usage.candidatesTokenCount || 0;
        const totalTokens = usage.totalTokenCount || 0;
        
        const estimatedCost = (promptTokens / 1000000 * 3.50) + (completionTokens / 1000000 * 10.50);

        await supabase.from('api_logs').insert([{
          model_name: 'gemini-2.5-flash',
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          estimated_cost: estimatedCost,
          latency_ms: latency,
          status_code: 200,
          payload: lastUserMessage
        }]);
        console.log(`[9Router] Logged usage: ${totalTokens} tokens, Cost: $${estimatedCost.toFixed(6)}`);
      } catch (logErr) {
        console.error(`[9Router] Failed to log to Supabase:`, logErr);
      }
    }
    
    // Pass the response back to the client in OpenAI format
    res.json({
      choices: [
        {
          message: {
            role: "assistant",
            content: aiReply
          }
        }
      ]
    });

  } catch (error) {
    console.error(`[9Router Error]`, error.message);
    res.status(500).json({
      error: {
        message: "Gagal terhubung ke Gemini AI. Periksa API Key Anda.",
        details: error.message
      }
    });
  }
});

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 9Router Backend is LIVE`);
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log(`🔗 Proxy Endpoint: http://localhost:${PORT}/v1/chat/completions`);
  console.log(`========================================`);
});
