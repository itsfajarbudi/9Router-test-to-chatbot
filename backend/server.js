const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const Groq = require('groq-sdk');
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

app.use(cors()); // Allow all origins for the API
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
    
    // Auto Routing (Prototype): Default to Gemini
    const targetModel = model === 'auto' ? 'gemini' : (model || 'gemini');
    console.log(`[9Router] Received request. Routing to ${targetModel.toUpperCase()} AI...`);
    
    let apiKey = process.env[`${targetModel.toUpperCase()}_API_KEY`];

    // Fetch key from Supabase if available (Secure DB Storage)
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('api_settings')
          .select('api_key')
          .eq('provider', targetModel)
          .single();
        
        if (data && data.api_key) {
          apiKey = data.api_key;
        }
      } catch (dbErr) {
        console.warn(`[9Router] Could not fetch ${targetModel} API Key from Supabase, falling back to .env`);
      }
    }

    if (!apiKey || apiKey === `your_${targetModel}_api_key_here`) {
      return res.status(401).json({
        error: { message: `API Key ${targetModel} belum dikonfigurasi. Masukkan via Dashboard atau .env.` }
      });
    }

    let aiReply = "";
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let estimatedCost = 0;
    let usedModelName = "";

    const startTime = Date.now();

    // --- GEMINI LOGIC ---
    if (targetModel === 'gemini') {
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

      let chatHistory = [];
      let expectedRole = 'user';
      for (const msg of rawHistory) {
        if (msg.role === expectedRole) {
          chatHistory.push(msg);
          expectedRole = expectedRole === 'user' ? 'model' : 'user';
        } else if (chatHistory.length > 0) {
          chatHistory[chatHistory.length - 1].parts[0].text += "\n\n" + msg.parts[0].text;
        }
      }

      usedModelName = "gemini-2.5-flash";
      const geminiModel = genAI.getGenerativeModel({
        model: usedModelName,
        systemInstruction: systemInstruction.trim() || undefined
      });

      if (chatHistory.length > 0) {
        chatHistory.pop(); 
      }

      const chat = geminiModel.startChat({
        history: chatHistory,
        generationConfig: { temperature: temperature || 0.7 }
      });

      const result = await chat.sendMessage(lastUserMessage);
      aiReply = result.response.text();
      
      const usage = result.response.usageMetadata || {};
      promptTokens = usage.promptTokenCount || 0;
      completionTokens = usage.candidatesTokenCount || 0;
      totalTokens = usage.totalTokenCount || 0;
      estimatedCost = (promptTokens / 1000000 * 3.50) + (completionTokens / 1000000 * 10.50); // Flash pricing
    } 
    // --- CLAUDE LOGIC ---
    else if (targetModel === 'claude') {
      usedModelName = "claude-3-5-sonnet-20240620";
      const anthropic = new Anthropic({ apiKey: apiKey });
      
      let systemInstruction = "";
      const anthropicMessages = [];
      
      messages.forEach(msg => {
        if (msg.role === 'system') {
          systemInstruction += msg.content + "\n";
        } else {
          // Anthropic roles: 'user' or 'assistant'
          anthropicMessages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          });
        }
      });

      const response = await anthropic.messages.create({
        model: usedModelName,
        max_tokens: 4096,
        temperature: temperature || 0.7,
        system: systemInstruction.trim() || undefined,
        messages: anthropicMessages
      });

      aiReply = response.content[0].text;
      promptTokens = response.usage.input_tokens || 0;
      completionTokens = response.usage.output_tokens || 0;
      totalTokens = promptTokens + completionTokens;
      estimatedCost = (promptTokens / 1000000 * 3.00) + (completionTokens / 1000000 * 15.00); // Sonnet pricing
    }
    // --- GROQ LOGIC ---
    else if (targetModel === 'groq') {
      usedModelName = "llama3-8b-8192";
      const groq = new Groq({ apiKey: apiKey });
      
      const groqMessages = messages.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : msg.role,
        content: msg.content
      }));

      const response = await groq.chat.completions.create({
        messages: groqMessages,
        model: usedModelName,
        temperature: temperature || 0.7,
      });

      aiReply = response.choices[0]?.message?.content || "";
      promptTokens = response.usage?.prompt_tokens || 0;
      completionTokens = response.usage?.completion_tokens || 0;
      totalTokens = response.usage?.total_tokens || 0;
      estimatedCost = (promptTokens / 1000000 * 0.05) + (completionTokens / 1000000 * 0.08); // Groq 8B pricing
    } else {
      throw new Error(`Unsupported model: ${targetModel}`);
    }

    const latency = Date.now() - startTime;
    console.log(`[9Router] Successfully received response from ${targetModel.toUpperCase()}.`);
    
    // Log usage to Supabase
    if (supabase) {
      try {
        await supabase.from('api_logs').insert([{
          model_name: usedModelName,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          estimated_cost: estimatedCost,
          latency_ms: latency,
          status_code: 200,
          payload: messages[messages.length - 1].content // log last user message
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
        message: `Gagal terhubung ke AI. Periksa API Key Anda.`,
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
