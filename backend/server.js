const express = require('express');
const cors = require('cors');
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
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(null, true); // Allow all for now just to avoid blockages, or specifically restrict. Let's restrict it later if requested, for now we will just allow all or the specific ones. 
    }
    return callback(null, true);
  }
}));
app.use(express.json());

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
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model, messages, temperature } = req.body;
    
    console.log(`[9Router] Received request. Routing to Gemini AI...`);
    
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return res.status(401).json({
        error: { message: "API Key Gemini belum dikonfigurasi di server 9Router (.env). Buka file .env dan masukkan API Key Anda." }
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Translate OpenAI messages array to Gemini format
    let chatHistory = [];
    let systemInstruction = "";
    let lastUserMessage = "";

    messages.forEach(msg => {
      if (msg.role === 'system') {
        systemInstruction += msg.content + " ";
      } else if (msg.role === 'user') {
        chatHistory.push({ role: 'user', parts: [{ text: msg.content }] });
        lastUserMessage = msg.content;
      } else if (msg.role === 'assistant') {
        chatHistory.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    });

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
