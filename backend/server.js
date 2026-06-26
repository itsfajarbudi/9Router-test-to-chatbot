const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const Groq = require('groq-sdk');
const { OpenAI } = require('openai');
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

// Root endpoint for friendly greeting
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

// ==========================================
// AI PROVIDER REGISTRY (STRATEGY PATTERN)
// ==========================================
// This architecture makes it extremely easy to add new AI APIs in the future.
// Each provider must return an object with: { aiReply, promptTokens, completionTokens, totalTokens, estimatedCost, usedModelName }
const PROVIDERS = {
  gemini: async ({ apiKey, messages, temperature }) => {
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

    const usedModelName = "gemini-2.5-flash";
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
    const aiReply = result.response.text();
    const usage = result.response.usageMetadata || {};
    const promptTokens = usage.promptTokenCount || 0;
    const completionTokens = usage.candidatesTokenCount || 0;
    
    return {
      aiReply,
      promptTokens,
      completionTokens,
      totalTokens: usage.totalTokenCount || 0,
      estimatedCost: (promptTokens / 1000000 * 0.075) + (completionTokens / 1000000 * 0.30),
      usedModelName
    };
  },

  claude: async ({ apiKey, messages, temperature }) => {
    const anthropic = new Anthropic({ apiKey });
    let systemInstruction = "";
    const anthropicMessages = [];
    
    messages.forEach(msg => {
      if (msg.role === 'system') {
        systemInstruction += msg.content + "\n";
      } else {
        anthropicMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    });

    const usedModelName = "claude-3-5-sonnet-20240620";
    const response = await anthropic.messages.create({
      model: usedModelName,
      max_tokens: 4096,
      temperature: temperature || 0.7,
      system: systemInstruction.trim() || undefined,
      messages: anthropicMessages
    });

    const promptTokens = response.usage.input_tokens || 0;
    const completionTokens = response.usage.output_tokens || 0;
    
    return {
      aiReply: response.content[0].text,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCost: (promptTokens / 1000000 * 3.00) + (completionTokens / 1000000 * 15.00),
      usedModelName
    };
  },

  groq: async ({ apiKey, messages, temperature }) => {
    const groq = new Groq({ apiKey });
    const groqMessages = messages.map(msg => ({
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: msg.content
    }));

    const usedModelName = "llama-3.1-8b-instant";
    const response = await groq.chat.completions.create({
      messages: groqMessages,
      model: usedModelName,
      temperature: temperature || 0.7,
    });

    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    
    return {
      aiReply: response.choices[0]?.message?.content || "",
      promptTokens,
      completionTokens,
      totalTokens: response.usage?.total_tokens || 0,
      estimatedCost: (promptTokens / 1000000 * 0.05) + (completionTokens / 1000000 * 0.08),
      usedModelName
    };
  },

  openai: async ({ apiKey, messages, temperature }) => {
    const openai = new OpenAI({ apiKey });
    const openaiMessages = messages.map(msg => ({
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: msg.content
    }));

    const usedModelName = "gpt-4o";
    const response = await openai.chat.completions.create({
      messages: openaiMessages,
      model: usedModelName,
      temperature: temperature || 0.7,
    });

    const pT = response.usage?.prompt_tokens || 0;
    const cT = response.usage?.completion_tokens || 0;

    return {
      aiReply: response.choices[0]?.message?.content || "",
      promptTokens: pT,
      completionTokens: cT,
      totalTokens: response.usage?.total_tokens || 0,
      estimatedCost: (pT / 1000000 * 5.00) + (cT / 1000000 * 15.00),
      usedModelName
    };
  },

  deepseek: async ({ apiKey, messages, temperature }) => {
    const openai = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
    const deepseekMessages = messages.map(msg => ({
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: msg.content
    }));

    const usedModelName = "deepseek-chat";
    const response = await openai.chat.completions.create({
      messages: deepseekMessages,
      model: usedModelName,
      temperature: temperature || 0.7,
    });

    const pT = response.usage?.prompt_tokens || 0;
    const cT = response.usage?.completion_tokens || 0;

    return {
      aiReply: response.choices[0]?.message?.content || "",
      promptTokens: pT,
      completionTokens: cT,
      totalTokens: response.usage?.total_tokens || 0,
      estimatedCost: (pT / 1000000 * 0.14) + (cT / 1000000 * 0.28),
      usedModelName
    };
  },

  qwen: async ({ apiKey, messages, temperature }) => {
    // Use workspace-specific OpenAI-compatible endpoint for Qwen
    const openai = new OpenAI({ apiKey, baseURL: 'https://ws-k6d35118uujugt6w.cn-beijing.maas.aliyuncs.com/compatible-mode/v1' });
    const qwenMessages = messages.map(msg => ({
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: msg.content
    }));

    const usedModelName = "qwen-max";
    const response = await openai.chat.completions.create({
      messages: qwenMessages,
      model: usedModelName,
      temperature: temperature || 0.7,
    });

    const pT = response.usage?.prompt_tokens || 0;
    const cT = response.usage?.completion_tokens || 0;

    return {
      aiReply: response.choices[0]?.message?.content || "",
      promptTokens: pT,
      completionTokens: cT,
      totalTokens: response.usage?.total_tokens || 0,
      estimatedCost: (pT / 1000000 * 1.50) + (cT / 1000000 * 4.50), // Approx cost for Qwen-Max
      usedModelName
    };
  }
};


// OpenAI compatible endpoint
app.post('/v1/chat/completions', apiLimiter, async (req, res) => {
  try {
    // 1. Validate Router Authentication
    const authHeader = req.headers.authorization;
    const validToken = process.env.ROUTER_API_KEY || 'portofolio-fajar';
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== validToken) {
      console.warn(`[9Router Security] Blocked unauthorized request from IP: ${req.ip}`);
      return res.status(401).json({ error: { message: "Unauthorized. Invalid or missing Router API Key." } });
    }

    const { model, messages, temperature } = req.body;
    
    // Auto Routing (Prototype): Default to Gemini
    const targetModel = model === 'auto' ? 'gemini' : (model || 'gemini');
    console.log(`[9Router] Received request. Routing to ${targetModel.toUpperCase()} AI...`);
    
    // 2. Select the strategy handler
    const handler = PROVIDERS[targetModel];
    if (!handler) {
      return res.status(400).json({ error: { message: `Unsupported model/provider: ${targetModel}. Silakan tambahkan logic di PROVIDERS.` } });
    }

    // 3. Get API Key
    let apiKey = process.env[`${targetModel.toUpperCase()}_API_KEY`];

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
        error: { message: `API Key untuk provider ${targetModel.toUpperCase()} belum dikonfigurasi. Masukkan via Dashboard.` }
      });
    }

    const startTime = Date.now();
    let result;
    
    // 4. Process Request via Provider Strategy
    try {
      result = await handler({ apiKey, messages, temperature });
    } catch (apiError) {
      // PROPER ERROR PASS-THROUGH: Pass actual API errors to client
      console.error(`[9Router Provider Error - ${targetModel}] `, apiError.message);
      
      const errorMsg = apiError.error?.error?.message || apiError.error?.message || apiError.message || "Unknown Provider Error";
      return res.status(apiError.status || 500).json({
        error: {
          message: errorMsg,
          type: "provider_error",
          provider: targetModel
        }
      });
    }

    const latency = Date.now() - startTime;
    console.log(`[9Router] Successfully received response from ${targetModel.toUpperCase()}.`);
    
    // 5. Log usage to Supabase
    if (supabase) {
      try {
        await supabase.from('api_logs').insert([{
          model_name: result.usedModelName,
          prompt_tokens: result.promptTokens,
          completion_tokens: result.completionTokens,
          total_tokens: result.totalTokens,
          estimated_cost: result.estimatedCost,
          latency_ms: latency,
          status_code: 200,
          payload: messages[messages.length - 1].content // log last user message
        }]);
        console.log(`[9Router] Logged usage: ${result.totalTokens} tokens, Cost: $${result.estimatedCost.toFixed(6)}`);
      } catch (logErr) {
        console.error(`[9Router] Failed to log to Supabase:`, logErr);
      }
    }
    
    // 6. Pass the response back to the client in OpenAI format
    res.json({
      choices: [
        {
          message: {
            role: "assistant",
            content: result.aiReply
          }
        }
      ]
    });

  } catch (error) {
    console.error(`[9Router System Error]`, error);
    res.status(500).json({
      error: {
        message: "Internal 9Router Error",
        details: error.message
      }
    });
  }
});

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 9Router Backend is LIVE (Provider Registry Mode)`);
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log(`🔗 Proxy Endpoint: http://localhost:${PORT}/v1/chat/completions`);
  console.log(`========================================`);
});
