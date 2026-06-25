const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

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

    const result = await chat.sendMessage(lastUserMessage);
    const aiReply = result.response.text();

    console.log(`[9Router] Successfully received response from Gemini.`);
    
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
