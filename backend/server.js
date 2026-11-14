'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const Groq = require('groq-sdk');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ============================================
// NAROOT — AI API Gateway & Token Router
// ============================================

const app = express();
const PORT = process.env.PORT || 8080;
const NAROOT_VERSION = '2.1.0';

// -------------------------------------------
// Supabase Initialization
// -------------------------------------------
let supabase;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('[Naroot] Supabase Analytics Tracking Enabled.');
} else {
  console.warn('[Naroot] Supabase not configured — analytics disabled.');
}

// -------------------------------------------
// Security Middleware (Helmet with Relaxed Script CSP for Web Console)
// -------------------------------------------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "http://localhost:*", "http://127.0.0.1:*", "https:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS Configuration
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.length === 0) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Origin not allowed'), false);
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'X-Naroot-Provider', 'X-Naroot-Latency', 'X-Naroot-Cache'],
  maxAge: 86400,
}));

// Static assets from React Dashboard
const PUBLIC_DIR = path.join(__dirname, 'public');
const DIST_DIR = path.join(__dirname, '../dashboard/dist');
const DASHBOARD_DIST = fs.existsSync(path.join(PUBLIC_DIR, 'index.html')) ? PUBLIC_DIR : DIST_DIR;
app.use(express.static(DASHBOARD_DIST));

// Body parser with size limit
app.use(express.json({ limit: '100kb' }));

// -------------------------------------------
// Request ID Middleware
// -------------------------------------------
app.use((req, _res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  next();
});

// -------------------------------------------
// Rate Limiter
// -------------------------------------------
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true },
  message: {
    error: {
      message: 'Too many requests from this IP. Please try again after 15 minutes.',
      type: 'rate_limit_error',
      code: 429,
    },
  },
});

// -------------------------------------------
// Request Validation Schemas (Zod)
// -------------------------------------------
const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'model']),
  content: z.string().min(1, 'Message content must not be empty').max(100000, 'Message content too large'),
});

const ChatCompletionRequestSchema = z.object({
  model: z.string().max(100).optional().default('auto'),
  messages: z.array(MessageSchema).min(1, 'At least one message is required').max(100, 'Too many messages'),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  max_tokens: z.number().int().min(1).max(32768).optional(),
  stream: z.boolean().optional().default(false),
});

// -------------------------------------------
// In-Memory LRU Cache
// -------------------------------------------
class LRUCache {
  constructor(maxSize = 100, ttlMs = 300000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0 };
  }

  _generateKey(model, messages, temperature) {
    const payload = JSON.stringify({ model, messages, temperature });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  get(model, messages, temperature) {
    const key = this._generateKey(model, messages, temperature);
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.stats.hits++;
    return entry.data;
  }

  set(model, messages, temperature, data) {
    const key = this._generateKey(model, messages, temperature);
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) + '%' : '0%',
    };
  }
}

const responseCache = new LRUCache(
  parseInt(process.env.CACHE_MAX_SIZE || '100', 10),
  parseInt(process.env.CACHE_TTL_MS || '300000', 10)
);

// -------------------------------------------
// Provider Health Tracker
// -------------------------------------------
const providerHealth = {};

function recordProviderResult(provider, success, latencyMs) {
  if (!providerHealth[provider]) {
    providerHealth[provider] = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      avgLatencyMs: 0,
      lastLatencyMs: 0,
      lastError: null,
      lastSuccessAt: null,
      lastFailureAt: null,
    };
  }
  const h = providerHealth[provider];
  h.totalRequests++;
  if (success) {
    h.successCount++;
    h.lastLatencyMs = latencyMs;
    h.avgLatencyMs = Math.round(
      (h.avgLatencyMs * (h.successCount - 1) + latencyMs) / h.successCount
    );
    h.lastSuccessAt = new Date().toISOString();
  } else {
    h.failureCount++;
    h.lastFailureAt = new Date().toISOString();
  }
}

// -------------------------------------------
// Authentication Helper & Middleware
// -------------------------------------------
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.query && (req.query.token || req.query.key || req.query.api_key)) {
    return (req.query.token || req.query.key || req.query.api_key).trim();
  }
  return null;
}

function authenticateRequest(req, res, next) {
  const token = extractToken(req);
  const validToken = process.env.ROUTER_API_KEY || 'portofolio-fajar';

  if (!token) {
    console.warn(`[Naroot Security] Blocked request without auth from IP: ${req.ip}`);
    return res.status(401).json({
      error: {
        message: 'Unauthorized. Missing Bearer token or ?token= query parameter.',
        type: 'authentication_error',
        code: 401,
      },
    });
  }

  // Constant-time comparison
  const tokenBuffer = Buffer.from(token);
  const validBuffer = Buffer.from(validToken);
  if (tokenBuffer.length !== validBuffer.length || !crypto.timingSafeEqual(tokenBuffer, validBuffer)) {
    console.warn(`[Naroot Security] Blocked unauthorized request from IP: ${req.ip}`);
    return res.status(401).json({
      error: {
        message: 'Unauthorized. Invalid Router API Key.',
        type: 'authentication_error',
        code: 401,
      },
    });
  }

  next();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// -------------------------------------------
// In-Memory Cached API Key Resolver
// -------------------------------------------
let cachedDbKeys = null;
let lastDbKeysFetch = 0;

async function getAllDbKeys() {
  const now = Date.now();
  if (cachedDbKeys && (now - lastDbKeysFetch < 45000)) {
    return cachedDbKeys;
  }
  if (!supabase) return {};
  try {
    const { data } = await supabase.from('api_settings').select('provider, api_key');
    if (data) {
      cachedDbKeys = {};
      data.forEach(row => { cachedDbKeys[row.provider] = row.api_key; });
      lastDbKeysFetch = now;
      return cachedDbKeys;
    }
  } catch (_err) {
    // ignore
  }
  return cachedDbKeys || {};
}

async function resolveApiKey(provider) {
  let apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
  const dbKeys = await getAllDbKeys();
  if (dbKeys[provider]) {
    apiKey = dbKeys[provider];
  }
  if (!apiKey || apiKey.startsWith('your_')) {
    return null;
  }
  return apiKey;
}

// ==========================================
// AI PROVIDER REGISTRY (STRATEGY PATTERN)
// ==========================================
const PROVIDER_TIMEOUT_MS = parseInt(process.env.PROVIDER_TIMEOUT_MS || '30000', 10);

const PROVIDERS = {
  gemini: {
    displayName: 'Gemini 2.5 Flash',
    modelId: 'gemini-2.5-flash',
    costPer1MInput: 0.075,
    costPer1MOutput: 0.30,
    contextWindow: '1M tokens',
    speed: 'Ultra Fast',
    handler: async ({ apiKey, messages, temperature, maxTokens }) => {
      const genAI = new GoogleGenerativeAI(apiKey);
      let systemInstruction = '';
      let lastUserMessage = '';

      messages.forEach(msg => {
        if (msg.role === 'system') {
          systemInstruction += msg.content + ' ';
        } else if (msg.role === 'user') {
          lastUserMessage = msg.content;
        }
      });

      const rawHistory = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }));

      const chatHistory = [];
      let expectedRole = 'user';
      for (const msg of rawHistory) {
        if (msg.role === expectedRole) {
          chatHistory.push(msg);
          expectedRole = expectedRole === 'user' ? 'model' : 'user';
        } else if (chatHistory.length > 0) {
          chatHistory[chatHistory.length - 1].parts[0].text += '\n\n' + msg.parts[0].text;
        }
      }

      const usedModelName = 'gemini-2.5-flash';
      const geminiModel = genAI.getGenerativeModel({
        model: usedModelName,
        systemInstruction: systemInstruction.trim() || undefined,
      });

      if (chatHistory.length > 0) {
        chatHistory.pop();
      }

      const generationConfig = { temperature: temperature || 0.7 };
      if (maxTokens) generationConfig.maxOutputTokens = maxTokens;

      const chat = geminiModel.startChat({
        history: chatHistory,
        generationConfig,
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
        estimatedCost: (promptTokens / 1e6 * 0.075) + (completionTokens / 1e6 * 0.30),
        usedModelName,
      };
    },
  },

  claude: {
    displayName: 'Claude 3.5 Sonnet',
    modelId: 'claude-3-5-sonnet-20240620',
    costPer1MInput: 3.00,
    costPer1MOutput: 15.00,
    contextWindow: '200K tokens',
    speed: 'High Intelligence',
    handler: async ({ apiKey, messages, temperature, maxTokens }) => {
      const anthropic = new Anthropic({ apiKey });
      let systemInstruction = '';
      const anthropicMessages = [];

      messages.forEach(msg => {
        if (msg.role === 'system') {
          systemInstruction += msg.content + '\n';
        } else {
          anthropicMessages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
          });
        }
      });

      const usedModelName = 'claude-3-5-sonnet-20240620';
      const response = await anthropic.messages.create({
        model: usedModelName,
        max_tokens: maxTokens || 4096,
        temperature: temperature || 0.7,
        system: systemInstruction.trim() || undefined,
        messages: anthropicMessages,
      });

      const promptTokens = response.usage.input_tokens || 0;
      const completionTokens = response.usage.output_tokens || 0;

      return {
        aiReply: response.content[0].text,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCost: (promptTokens / 1e6 * 3.00) + (completionTokens / 1e6 * 15.00),
        usedModelName,
      };
    },
  },

  groq: {
    displayName: 'Groq (Qwen 3.8 27B)',
    modelId: 'qwen/qwen3.8-27b',
    costPer1MInput: 0.05,
    costPer1MOutput: 0.08,
    contextWindow: '128K tokens',
    speed: 'Ultra Fast (<150ms)',
    handler: async ({ apiKey, messages, temperature, maxTokens }) => {
      const groq = new Groq({ apiKey });
      const groqMessages = messages.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : msg.role,
        content: msg.content,
      }));

      const usedModelName = 'qwen/qwen3.8-27b';
      const params = {
        messages: groqMessages,
        model: usedModelName,
        temperature: temperature || 0.7,
      };
      if (maxTokens) params.max_tokens = maxTokens;

      const response = await groq.chat.completions.create(params);
      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;

      return {
        aiReply: response.choices[0]?.message?.content || '',
        promptTokens,
        completionTokens,
        totalTokens: response.usage?.total_tokens || 0,
        estimatedCost: (promptTokens / 1e6 * 0.05) + (completionTokens / 1e6 * 0.08),
        usedModelName,
      };
    },
  },

  openai: {
    displayName: 'OpenAI GPT-4o',
    modelId: 'gpt-4o',
    costPer1MInput: 5.00,
    costPer1MOutput: 15.00,
    contextWindow: '128K tokens',
    speed: 'Industry Standard',
    handler: async ({ apiKey, messages, temperature, maxTokens }) => {
      const openai = new OpenAI({ apiKey });
      const openaiMessages = messages.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : msg.role,
        content: msg.content,
      }));

      const usedModelName = 'gpt-4o';
      const params = {
        messages: openaiMessages,
        model: usedModelName,
        temperature: temperature || 0.7,
      };
      if (maxTokens) params.max_tokens = maxTokens;

      const response = await openai.chat.completions.create(params);
      const pT = response.usage?.prompt_tokens || 0;
      const cT = response.usage?.completion_tokens || 0;

      return {
        aiReply: response.choices[0]?.message?.content || '',
        promptTokens: pT,
        completionTokens: cT,
        totalTokens: response.usage?.total_tokens || 0,
        estimatedCost: (pT / 1e6 * 5.00) + (cT / 1e6 * 15.00),
        usedModelName,
      };
    },
  },

  deepseek: {
    displayName: 'DeepSeek V3',
    modelId: 'deepseek-chat',
    costPer1MInput: 0.14,
    costPer1MOutput: 0.28,
    contextWindow: '64K tokens',
    speed: 'Cost-Effective',
    handler: async ({ apiKey, messages, temperature, maxTokens }) => {
      const openai = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
      const deepseekMessages = messages.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : msg.role,
        content: msg.content,
      }));

      const usedModelName = 'deepseek-chat';
      const params = {
        messages: deepseekMessages,
        model: usedModelName,
        temperature: temperature || 0.7,
      };
      if (maxTokens) params.max_tokens = maxTokens;

      const response = await openai.chat.completions.create(params);
      const pT = response.usage?.prompt_tokens || 0;
      const cT = response.usage?.completion_tokens || 0;

      return {
        aiReply: response.choices[0]?.message?.content || '',
        promptTokens: pT,
        completionTokens: cT,
        totalTokens: response.usage?.total_tokens || 0,
        estimatedCost: (pT / 1e6 * 0.14) + (cT / 1e6 * 0.28),
        usedModelName,
      };
    },
  },

  qwen: {
    displayName: 'Qwen Plus',
    modelId: 'qwen-plus',
    costPer1MInput: 1.50,
    costPer1MOutput: 4.50,
    contextWindow: '128K tokens',
    speed: 'Multilingual Leader',
    handler: async ({ apiKey, messages, temperature, maxTokens }) => {
      const openai = new OpenAI({
        apiKey,
        baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      });
      const qwenMessages = messages.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : msg.role,
        content: msg.content,
      }));

      const usedModelName = 'qwen-plus';
      const params = {
        messages: qwenMessages,
        model: usedModelName,
        temperature: temperature || 0.7,
      };
      if (maxTokens) params.max_tokens = maxTokens;

      const response = await openai.chat.completions.create(params);
      const pT = response.usage?.prompt_tokens || 0;
      const cT = response.usage?.completion_tokens || 0;

      return {
        aiReply: response.choices[0]?.message?.content || '',
        promptTokens: pT,
        completionTokens: cT,
        totalTokens: response.usage?.total_tokens || 0,
        estimatedCost: (pT / 1e6 * 1.50) + (cT / 1e6 * 4.50),
        usedModelName,
      };
    },
  },
};

const ALL_PROVIDER_IDS = Object.keys(PROVIDERS);

function resolveProvider(modelName) {
  if (!modelName || modelName === 'auto') return 'gemini';
  const m = modelName.toLowerCase();
  if (m.includes('claude') || m === 'anthropic') return 'claude';
  if (m.includes('gemini')) return 'gemini';
  if (m.includes('llama') || m === 'groq') return 'groq';
  if (m.includes('gpt') || m === 'openai') return 'openai';
  if (m.includes('deepseek')) return 'deepseek';
  if (m.includes('qwen')) return 'qwen';
  return m;
}

function buildFallbackChain(primary) {
  return [primary, ...ALL_PROVIDER_IDS.filter(p => p !== primary)];
}

async function executeWithTimeout(handler, params, timeoutMs) {
  return Promise.race([
    handler(params),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Provider timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// ==========================================
// ROUTES
// ==========================================

// -------------------------------------------
// ROOT & SPA: Serve React Dashboard
// -------------------------------------------
app.get('/', (_req, res) => {
  res.sendFile(path.join(DASHBOARD_DIST, 'index.html'));
});

// -------------------------------------------
// Health Check Endpoint
// -------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'naroot',
    version: NAROOT_VERSION,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    providers: ALL_PROVIDER_IDS.length,
    cache: responseCache.getStats(),
  });
});

// -------------------------------------------
// GET /v1/models — Public / Token-Friendly Model Catalog
// -------------------------------------------
app.get('/v1/models', async (req, res) => {
  try {
    // If auth token is provided, validate it. If not, still return public model list!
    const token = extractToken(req);
    const validToken = process.env.ROUTER_API_KEY || 'portofolio-fajar';

    if (token) {
      const tokenBuffer = Buffer.from(token);
      const validBuffer = Buffer.from(validToken);
      if (tokenBuffer.length !== validBuffer.length || !crypto.timingSafeEqual(tokenBuffer, validBuffer)) {
        return res.status(401).json({
          error: { message: 'Unauthorized. Invalid Router API Key.', type: 'authentication_error', code: 401 }
        });
      }
    }

    const dbKeys = await getAllDbKeys();
    const models = ALL_PROVIDER_IDS.map(id => {
      const provider = PROVIDERS[id];
      const hasKey = !!(process.env[`${id.toUpperCase()}_API_KEY`] || dbKeys[id]);
      return {
        id: provider.modelId,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: id,
        provider: id,
        display_name: provider.displayName,
        available: hasKey,
        context_window: provider.contextWindow,
        speed: provider.speed,
        pricing: {
          input: `$${provider.costPer1MInput}/1M tokens`,
          output: `$${provider.costPer1MOutput}/1M tokens`,
        },
      };
    });

    res.json({
      object: 'list',
      data: models,
    });
  } catch (error) {
    console.error('[Naroot] Error listing models:', error.message);
    res.status(500).json({ error: { message: 'Failed to list models', type: 'server_error' } });
  }
});

// -------------------------------------------
// GET /v1/usage — Usage Statistics (Protected)
// -------------------------------------------
app.get('/v1/usage', authenticateRequest, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: { message: 'Analytics not configured (Supabase not connected)', type: 'configuration_error' },
      });
    }

    const { period } = req.query;
    let query = supabase.from('api_logs').select('model_name, total_tokens, estimated_cost, prompt_tokens, completion_tokens, latency_ms, created_at');

    const now = new Date();
    if (period === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      query = query.gte('created_at', todayStart);
    } else if (period === '7d') {
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', weekAgo);
    } else if (period === '30d') {
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', monthAgo);
    }

    const { data, error } = await query;
    if (error) throw error;

    const byProvider = {};
    let totalTokens = 0;
    let totalCost = 0;
    let totalRequests = 0;

    for (const row of (data || [])) {
      totalRequests++;
      totalTokens += row.total_tokens || 0;
      totalCost += row.estimated_cost || 0;

      const provider = row.model_name || 'unknown';
      if (!byProvider[provider]) {
        byProvider[provider] = { requests: 0, tokens: 0, cost: 0, avgLatency: 0, totalLatency: 0 };
      }
      byProvider[provider].requests++;
      byProvider[provider].tokens += row.total_tokens || 0;
      byProvider[provider].cost += row.estimated_cost || 0;
      byProvider[provider].totalLatency += row.latency_ms || 0;
    }

    for (const [key, val] of Object.entries(byProvider)) {
      byProvider[key].avgLatency = val.requests > 0 ? Math.round(val.totalLatency / val.requests) : 0;
      delete byProvider[key].totalLatency;
      byProvider[key].cost = parseFloat(val.cost.toFixed(6));
    }

    res.json({
      period: period || 'all',
      summary: {
        total_requests: totalRequests,
        total_tokens: totalTokens,
        total_cost_usd: parseFloat(totalCost.toFixed(6)),
      },
      by_provider: byProvider,
    });
  } catch (error) {
    console.error('[Naroot] Error fetching usage:', error.message);
    res.status(500).json({ error: { message: 'Failed to fetch usage stats', type: 'server_error' } });
  }
});

// -------------------------------------------
// GET /v1/health/providers — Provider Health
// -------------------------------------------
app.get('/v1/health/providers', authenticateRequest, async (_req, res) => {
  const dbKeys = await getAllDbKeys();
  const results = {};
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    const hasKey = !!(process.env[`${id.toUpperCase()}_API_KEY`] || dbKeys[id]);
    const h = providerHealth[id];
    results[id] = {
      display_name: provider.displayName,
      model_id: provider.modelId,
      key_configured: hasKey,
      health: h ? {
        total_requests: h.totalRequests,
        success_count: h.successCount,
        failure_count: h.failureCount,
        success_rate: h.totalRequests > 0 ? ((h.successCount / h.totalRequests) * 100).toFixed(1) + '%' : 'N/A',
        avg_latency_ms: h.avgLatencyMs,
        last_latency_ms: h.lastLatencyMs,
        last_success_at: h.lastSuccessAt,
        last_failure_at: h.lastFailureAt,
        last_error: h.lastError,
      } : { status: 'no_data' },
    };
  }

  res.json({
    timestamp: new Date().toISOString(),
    providers: results,
  });
});

// -------------------------------------------
// GET /v1/cache/stats — Cache Statistics
// -------------------------------------------
app.get('/v1/cache/stats', authenticateRequest, (_req, res) => {
  res.json({
    cache: responseCache.getStats(),
  });
});

// -------------------------------------------
// DELETE /v1/cache — Clear Cache
// -------------------------------------------
app.delete('/v1/cache', authenticateRequest, (_req, res) => {
  responseCache.clear();
  res.json({ message: 'Cache cleared successfully' });
});

// ==========================================
// POST /v1/chat/completions — Main AI Router
// ==========================================
app.post('/v1/chat/completions', apiLimiter, authenticateRequest, async (req, res) => {
  const requestId = req.requestId;

  try {
    const parseResult = ChatCompletionRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      return res.status(400).json({
        error: {
          message: 'Invalid request body',
          type: 'validation_error',
          details: errors,
          request_id: requestId,
        },
      });
    }

    const { model, messages, temperature, max_tokens: maxTokens, stream } = parseResult.data;

    // Cache lookup for non-streaming queries
    if (!stream) {
      const cached = responseCache.get(model, messages, temperature);
      if (cached) {
        console.log(`[Naroot] Cache HIT for request ${requestId}`);
        res.setHeader('X-Request-ID', requestId);
        res.setHeader('X-Naroot-Cache', 'HIT');
        return res.json({
          ...cached,
          id: `chatcmpl-${Date.now()}`,
          request_id: requestId,
        });
      }
    }

    const targetProvider = resolveProvider(model);
    const fallbackChain = buildFallbackChain(targetProvider);

    console.log(`[Naroot] [${requestId}] Request for '${model}' → Primary: ${targetProvider.toUpperCase()}`);

    let result = null;
    let successfulProvider = null;
    let lastError = null;
    let latency = 0;

    for (const currentProvider of fallbackChain) {
      const providerConfig = PROVIDERS[currentProvider];
      if (!providerConfig) {
        lastError = { status: 400, message: `Unsupported provider: ${currentProvider}`, type: 'configuration_error' };
        continue;
      }

      const apiKey = await resolveApiKey(currentProvider);
      if (!apiKey) {
        console.warn(`[Naroot] [${requestId}] Skipping ${currentProvider.toUpperCase()} (no key)`);
        lastError = {
          status: 401,
          message: `API Key for ${currentProvider.toUpperCase()} is not configured.`,
          type: 'configuration_error',
          provider: currentProvider,
        };
        continue;
      }

      const maxRetries = 2;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
          console.log(`[Naroot] [${requestId}] Retry #${attempt} for ${currentProvider.toUpperCase()} in ${backoff}ms`);
          await sleep(backoff);
        }

        console.log(`[Naroot] [${requestId}] Attempting ${currentProvider.toUpperCase()} (attempt ${attempt + 1})...`);
        const startTime = Date.now();

        try {
          result = await executeWithTimeout(
            providerConfig.handler,
            { apiKey, messages, temperature, maxTokens },
            PROVIDER_TIMEOUT_MS
          );
          latency = Date.now() - startTime;
          successfulProvider = currentProvider;
          recordProviderResult(currentProvider, true, latency);
          console.log(`[Naroot] [${requestId}] SUCCESS: ${currentProvider.toUpperCase()} responded in ${latency}ms`);
          break;
        } catch (apiError) {
          latency = Date.now() - startTime;
          const errorMsg = apiError.error?.error?.message || apiError.error?.message || apiError.message || 'Unknown Provider Error';
          console.warn(`[Naroot] [${requestId}] FAILED: ${currentProvider.toUpperCase()} — ${errorMsg}`);

          lastError = {
            status: apiError.status || 500,
            message: errorMsg,
            type: 'provider_error',
            provider: currentProvider,
          };

          recordProviderResult(currentProvider, false, 0);
          providerHealth[currentProvider].lastError = errorMsg;

          const statusCode = apiError.status || apiError.statusCode || 500;
          if (statusCode >= 400 && statusCode < 500) {
            break;
          }
        }
      }

      if (successfulProvider) break;
    }

    if (!successfulProvider || !result) {
      console.error(`[Naroot] [${requestId}] ALL fallbacks exhausted.`);
      return res.status(lastError?.status || 500).json({
        error: lastError || { message: 'All AI providers failed.', type: 'server_error' },
        request_id: requestId,
      });
    }

    // SSE Streaming
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Request-ID', requestId);
      res.setHeader('X-Naroot-Provider', successfulProvider);

      const words = result.aiReply.split(' ');
      const chunkSize = 3;
      for (let i = 0; i < words.length; i += chunkSize) {
        const chunk = words.slice(i, i + chunkSize).join(' ');
        const isLast = (i + chunkSize) >= words.length;
        const sseData = {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: result.usedModelName,
          choices: [{
            index: 0,
            delta: { content: (i === 0 ? '' : ' ') + chunk },
            finish_reason: isLast ? 'stop' : null,
          }],
        };
        res.write(`data: ${JSON.stringify(sseData)}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();

      if (supabase) {
        supabase.from('api_logs').insert([{
          model_name: result.usedModelName,
          prompt_tokens: result.promptTokens,
          completion_tokens: result.completionTokens,
          total_tokens: result.totalTokens,
          estimated_cost: result.estimatedCost,
          latency_ms: latency,
          status_code: 200,
          payload: messages[messages.length - 1]?.content?.substring(0, 500) || '',
        }]).then(() => {}).catch(() => {});
      }
      return;
    }

    // Log to Supabase
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
          payload: messages[messages.length - 1]?.content?.substring(0, 500) || '',
        }]);
      } catch (_logErr) {
        // silent
      }
    }

    const responseBody = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: result.usedModelName,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: result.aiReply },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: result.promptTokens,
        completion_tokens: result.completionTokens,
        total_tokens: result.totalTokens,
      },
      system_fingerprint: `naroot-${NAROOT_VERSION}`,
      request_id: requestId,
    };

    responseCache.set(model, messages, temperature, responseBody);

    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Naroot-Provider', successfulProvider);
    res.setHeader('X-Naroot-Latency', String(latency));
    res.setHeader('X-Naroot-Cache', 'MISS');

    res.json(responseBody);

  } catch (error) {
    console.error(`[Naroot] [${requestId}] System Error:`, error.message);
    res.status(500).json({
      error: {
        message: 'Internal Naroot Gateway Error',
        type: 'server_error',
        request_id: requestId,
      },
    });
  }
});

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint not found. Visit http://localhost:8080/ for web console.',
      type: 'not_found',
      code: 404,
    },
  });
});

// Global Error Handler
app.use((err, _req, res, _next) => {
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      error: { message: 'CORS policy violation: Origin not allowed', type: 'forbidden', code: 403 },
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: { message: 'Request body too large. Maximum size is 100KB.', type: 'payload_too_large', code: 413 },
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { message: 'Invalid JSON in request body.', type: 'parse_error', code: 400 },
    });
  }

  console.error('[Naroot] Unhandled error:', err.message);
  res.status(500).json({
    error: { message: 'Internal server error', type: 'server_error', code: 500 },
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('============================================');
    console.log(`  🚀 Naroot AI Gateway v${NAROOT_VERSION}`);
    console.log(`  📡 Web Console: http://localhost:${PORT}`);
    console.log(`  📋 Models JSON: http://localhost:${PORT}/v1/models`);
    console.log(`  🔗 Chat Proxy : http://localhost:${PORT}/v1/chat/completions`);
    console.log('============================================');
  });
}

module.exports = app;
