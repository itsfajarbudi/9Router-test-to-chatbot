import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Settings2,
  KeyRound,
  BarChart3,
  Activity,
  Terminal,
  Save,
  CheckCircle2,
  Zap,
  Bot,
  Send,
  BrainCircuit,
  Sparkles,
  Cpu,
  Atom,
  Fingerprint,
  Layers,
  Server,
  Database,
  Copy,
  RefreshCw,
  Clock,
  Coins
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';
import './App.css';
import { supabase } from './supabaseClient';

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? (window.location.port === '8080' ? '' : 'http://localhost:8080')
  : 'https://9-router-test-to-chatbot.vercel.app';

const AI_MODELS = [
  { id: 'openai', name: 'OpenAI GPT-4o', color: '#10b981', Icon: BrainCircuit, speed: 'Industry Standard', context: '128K' },
  { id: 'gemini', name: 'Gemini 2.5 Flash', color: '#3b82f6', Icon: Sparkles, speed: 'Ultra Fast', context: '1M' },
  { id: 'claude', name: 'Claude 3.5 Sonnet', color: '#f97316', Icon: Cpu, speed: 'High Intelligence', context: '200K' },
  { id: 'groq', name: 'Groq (Qwen 3.8 / Llama)', color: '#f5333f', Icon: Zap, speed: '<150ms Instant', context: '128K' },
  { id: 'deepseek', name: 'DeepSeek (V3)', color: '#4d6bfe', Icon: Atom, speed: 'Cost-Effective', context: '64K' },
  { id: 'qwen', name: 'Alibaba Qwen Plus', color: '#06b6d4', Icon: Fingerprint, speed: 'Multilingual Leader', context: '128K' }
];

const MOCK_CHART_DATA = [
  { name: 'Mon', openai: 4000, gemini: 2400, claude: 2400 },
  { name: 'Tue', openai: 3000, gemini: 1398, claude: 2210 },
  { name: 'Wed', openai: 2000, gemini: 9800, claude: 2290 },
  { name: 'Thu', openai: 2780, gemini: 3908, claude: 2000 },
  { name: 'Fri', openai: 1890, gemini: 4800, claude: 2181 },
  { name: 'Sat', openai: 2390, gemini: 3800, claude: 2500 },
  { name: 'Sun', openai: 3490, gemini: 4300, claude: 2100 },
];

// --- Naralink Logo Component ---
const NaralinkLogo = ({ scale = 1, forceWhiteText = false, showSubtitle = true }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', position: 'relative', transform: `scale(${scale})`, transformOrigin: 'left center', margin: '10px 0' }}>
    <svg width="120" height="30" viewBox="0 0 120 30" style={{ position: 'absolute', top: -10, left: 10 }}>
      <path d="M 10,25 Q 60,-5 110,20" fill="none" stroke="#4ebaff" strokeWidth="4" strokeLinecap="round" />
      <path d="M 20,28 Q 65,5 105,25" fill="none" stroke="#25a5f7" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <div style={{ display: 'flex', alignItems: 'baseline', fontFamily: 'sans-serif', fontWeight: 800, fontSize: '28px', letterSpacing: '-1px' }}>
      <span style={{ color: '#4ebaff' }}>nara</span>
      <span style={{ color: forceWhiteText ? '#ffffff' : '#111827' }}>link</span>
    </div>
    {showSubtitle && (
      <div style={{ color: '#4ebaff', fontSize: '10px', fontWeight: 600, marginTop: '-5px', alignSelf: 'flex-end', paddingRight: '0px' }}>
        Digital Solution
      </div>
    )}
  </div>
);

// --- Sidebar Navigation with Clean Grouping ---
const Sidebar = ({ activeView, setActiveView }) => (
  <aside className="sidebar">
    <div className="sidebar-logo">
      <NaralinkLogo scale={1} forceWhiteText={true} />
    </div>
    <nav className="sidebar-nav">
      <div className="sidebar-section-title">MAIN CONTROL</div>
      <button className={activeView === 'dashboard' ? 'active' : ''} onClick={() => setActiveView('dashboard')}>
        <LayoutDashboard size={18} /> Dashboard
      </button>
      <button className={activeView === 'api_keys' ? 'active' : ''} onClick={() => setActiveView('api_keys')}>
        <KeyRound size={18} /> API Keys
      </button>
      <button className={activeView === 'chatbot' ? 'active' : ''} onClick={() => setActiveView('chatbot')}>
        <Bot size={18} /> AI Playground
      </button>
      <button className={activeView === 'routing' ? 'active' : ''} onClick={() => setActiveView('routing')}>
        <Settings2 size={18} /> Routing Strategy
      </button>

      <div className="sidebar-section-title">GATEWAY FEATURES</div>
      <button className={activeView === 'models' ? 'active' : ''} onClick={() => setActiveView('models')}>
        <Layers size={18} /> Model Catalog
      </button>
      <button className={activeView === 'health' ? 'active' : ''} onClick={() => setActiveView('health')}>
        <Server size={18} /> Provider Health
      </button>
      <button className={activeView === 'cache' ? 'active' : ''} onClick={() => setActiveView('cache')}>
        <Database size={18} /> Cache Manager
      </button>

      <div className="sidebar-section-title">INSIGHTS &amp; LOGS</div>
      <button className={activeView === 'analytics' ? 'active' : ''} onClick={() => setActiveView('analytics')}>
        <BarChart3 size={18} /> Usage Analytics
      </button>
      <button className={activeView === 'logs' ? 'active' : ''} onClick={() => setActiveView('logs')}>
        <Terminal size={18} /> Request Logs
      </button>
    </nav>
    <div className="sidebar-footer">
      <Activity size={16} className="pulse-icon" /> Naroot Gateway Active
    </div>
  </aside>
);

const RadialGraph = ({ activeNode }) => {
  const centerX = 250;
  const centerY = 250;
  const radius = 180;

  return (
    <div className="svg-wrapper">
      <svg viewBox="0 0 500 500" width="100%" height="100%">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {AI_MODELS.map((model, index) => {
          const angle = (index / AI_MODELS.length) * 2 * Math.PI - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          const isActive = activeNode === model.id;

          const dx = x - centerX;
          const dy = y - centerY;
          const curveDirection = index % 2 === 0 ? 1 : -1;
          const cpX = centerX + dx / 2 - dy * 0.25 * curveDirection;
          const cpY = centerY + dy / 2 + dx * 0.25 * curveDirection;
          const pathD = `M ${centerX} ${centerY} Q ${cpX} ${cpY} ${x} ${y}`;

          return (
            <g key={`line-${model.id}`}>
              <path d={pathD} stroke="rgba(255,255,255,0.06)" strokeWidth="2" fill="none" />
              {isActive && (
                <>
                  <path d={pathD} stroke={model.color} strokeWidth="2.5" filter="url(#glow)" className="pulse-icon" fill="none" />
                  <circle r="5" fill="#ffffff" filter="url(#glow)">
                    <animateMotion dur="1s" repeatCount="indefinite" path={pathD} />
                    <animate attributeName="opacity" values="0;1;0" dur="1s" repeatCount="indefinite" />
                  </circle>
                  <circle r="3" fill={model.color} filter="url(#glow)">
                    <animateMotion dur="1s" begin="0.2s" repeatCount="indefinite" path={pathD} />
                    <animate attributeName="opacity" values="0;1;0" dur="1s" begin="0.2s" repeatCount="indefinite" />
                  </circle>
                </>
              )}
            </g>
          );
        })}

        {AI_MODELS.map((model, index) => {
          const angle = (index / AI_MODELS.length) * 2 * Math.PI - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          const isActive = activeNode === model.id;

          return (
            <g key={`node-${model.id}`} transform={`translate(${x}, ${y})`}>
              <circle r={isActive ? "28" : "24"} fill="#111827" stroke={isActive ? model.color : "rgba(148, 163, 184, 0.25)"} strokeWidth={isActive ? "3" : "1.5"} filter={isActive ? "url(#glow)" : ""} className="ai-node" />
              <text y="-35" textAnchor="middle" fill={isActive ? model.color : "#94a3b8"} fontSize="12" fontWeight={isActive ? "700" : "500"} filter={isActive ? "url(#glow)" : ""}>
                {model.name}
              </text>
              <foreignObject x="-10" y="-10" width="20" height="20">
                <model.Icon size={20} color={isActive ? model.color : "#64748b"} />
              </foreignObject>
            </g>
          );
        })}

        <g transform={`translate(${centerX}, ${centerY})`}>
          <circle r="46" fill="#0b1222" stroke="#38bdf8" strokeWidth="2.5" className="center-node-bg" />
          <text y="5" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="bold" letterSpacing="0.5px">Naroot</text>
        </g>
      </svg>
    </div>
  );
};

const DashboardView = ({ totalTokens, totalCost, activeNode }) => (
  <div className="view-content dashboard-view">
    <div className="metrics-row">
      <div className="metric-box">
        <p>Total Tokens Processed</p>
        <h3>{totalTokens.toLocaleString()}</h3>
      </div>
      <div className="metric-box">
        <p>Estimated Cost</p>
        <h3 className="success">Rp {(totalCost * 16200).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</h3>
      </div>
      <div className="metric-box">
        <p>Active Model (Routing)</p>
        <h3 style={{ color: activeNode ? AI_MODELS.find(m => m.id === activeNode)?.color : '#94a3b8' }}>
          {activeNode ? AI_MODELS.find(m => m.id === activeNode)?.name : 'Idle'}
        </h3>
      </div>
    </div>
    <div className="dashboard-graph-area">
      <RadialGraph activeNode={activeNode} />
    </div>
  </div>
);

const ApiKeysView = ({ apiKeys, setApiKeys }) => {
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadKeys = async () => {
      const { data, error } = await supabase.from('api_settings').select('*');
      if (data && !error) {
        const loadedKeys = {};
        data.forEach(row => {
          loadedKeys[row.provider] = row.api_key;
        });
        setApiKeys(loadedKeys);
      }
    };
    loadKeys();
  }, [setApiKeys]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const upsertData = Object.keys(apiKeys).map(provider => ({
        provider: provider,
        api_key: apiKeys[provider]
      }));
      
      const { error } = await supabase.from('api_settings').upsert(upsertData, { onConflict: 'provider' });
      if (error) throw error;
      
      alert('API Keys berhasil disimpan dengan aman ke Database Supabase!');
    } catch (err) {
      alert('Gagal menyimpan API Keys: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="view-content api-keys-view">
      <div className="view-header">
        <h2>Provider API Keys</h2>
        <p>Manage your keys securely. Naroot uses these to forward your requests with automatic fallback.</p>
        
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', color: '#34d399', fontSize: '0.9rem' }}>
          <strong>Keamanan Database:</strong> Key disimpan langsung ke tabel Supabase <code>api_settings</code> dan di-cache secara aman oleh server Naroot.
        </div>
      </div>
      <div className="keys-grid">
        {AI_MODELS.map(model => (
          <div key={model.id} className="key-card">
            <div className="key-card-header">
              <span className="key-color-dot" style={{ backgroundColor: model.color }}></span>
              <h4>{model.name}</h4>
            </div>
            <input
              type="password"
              placeholder={`Enter ${model.name} API Key...`}
              className="key-input"
              value={apiKeys[model.id] || ''}
              onChange={(e) => setApiKeys({ ...apiKeys, [model.id]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <button className="save-btn" onClick={handleSave} disabled={isSaving}>
        <Save size={18} /> {isSaving ? 'Menyimpan...' : 'Save Configuration'}
      </button>
    </div>
  );
};

const RoutingView = ({ routingStrategy, setRoutingStrategy }) => (
  <div className="view-content routing-view">
    <div className="view-header">
      <h2>Routing Strategy</h2>
      <p>Configure how Naroot decides which AI model to use.</p>
    </div>
    <div className="strategy-cards">
      <div className={`strategy-card ${routingStrategy === 'cost' ? 'selected' : ''}`} onClick={() => setRoutingStrategy('cost')}>
        <div className="icon-wrapper"><CheckCircle2 color={routingStrategy === 'cost' ? '#38bdf8' : '#64748b'} /></div>
        <h3>Cost Optimized</h3>
        <p>Routes to the cheapest available model (Gemini &rarr; Groq &rarr; DeepSeek) that meets your prompt requirements.</p>
      </div>
      <div className={`strategy-card ${routingStrategy === 'speed' ? 'selected' : ''}`} onClick={() => setRoutingStrategy('speed')}>
        <div className="icon-wrapper"><CheckCircle2 color={routingStrategy === 'speed' ? '#38bdf8' : '#64748b'} /></div>
        <h3>Speed Optimized</h3>
        <p>Prioritizes ultra-low latency providers (Groq &lt;150ms and Gemini 2.5 Flash).</p>
      </div>
      <div className={`strategy-card ${routingStrategy === 'fallback' ? 'selected' : ''}`} onClick={() => setRoutingStrategy('fallback')}>
        <div className="icon-wrapper"><CheckCircle2 color={routingStrategy === 'fallback' ? '#38bdf8' : '#64748b'} /></div>
        <h3>High Availability (Fallback)</h3>
        <p>Automatic retry with exponential backoff; cascades through all 6 providers if rate limits or 500 errors occur.</p>
      </div>
    </div>
  </div>
);

// --- NEW FEATURE 1: MODEL CATALOG VIEW ---
const ModelsView = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/models`);
      const data = await res.json();
      setModels(data.data || []);
    } catch {
      // Fallback default list if local server not reached
      setModels(AI_MODELS.map(m => ({
        id: m.id,
        display_name: m.name,
        available: true,
        context_window: m.context || '128K',
        speed: m.speed || 'Fast',
        pricing: { input: '$0.05 - $5.00/1M', output: '$0.08 - $15.00/1M' }
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleCopy = (id) => {
    navigator.clipboard.writeText(id);
    alert(`Model ID "${id}" berhasil disalin!`);
  };

  return (
    <div className="view-content models-view">
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Model Catalog (/v1/models)</h2>
          <p>Daftar model AI yang aktif dan didukung oleh Naroot Gateway.</p>
        </div>
        <button className="save-btn" onClick={fetchModels} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}>
          <RefreshCw size={15} /> Refresh Catalog
        </button>
      </div>

      <div className="keys-grid">
        {loading ? (
          <div style={{ color: '#94a3b8', padding: '2rem' }}>Memuat katalog model...</div>
        ) : (
          models.map(m => (
            <div key={m.id} className="key-card">
              <div className="key-card-header" style={{ justifyContent: 'space-between' }}>
                <h4>{m.display_name}</h4>
                <span className={`status-badge ${m.available ? 'ok' : 'error'}`}>
                  {m.available ? 'Ready' : 'No Key'}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Model ID:</span>
                  <code style={{ color: '#38bdf8' }}>{m.id}</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Context Window:</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{m.context_window || '128K'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Speed:</span>
                  <span style={{ color: '#34d399', fontWeight: 600 }}>{m.speed || 'Fast'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Input Token:</span>
                  <span>{m.pricing?.input || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Output Token:</span>
                  <span>{m.pricing?.output || '-'}</span>
                </div>
              </div>
              <button 
                className="save-btn" 
                style={{ width: '100%', justifyContent: 'center', padding: '0.5rem', fontSize: '0.82rem', backgroundColor: 'rgba(255,255,255,0.06)' }}
                onClick={() => handleCopy(m.id)}
              >
                <Copy size={14} /> Copy Model ID
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- NEW FEATURE 2: PROVIDER HEALTH MONITOR VIEW ---
const HealthView = () => {
  const [providers, setProviders] = useState({});
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/health/providers`, {
        headers: { 'Authorization': 'Bearer portofolio-fajar' }
      });
      const data = await res.json();
      setProviders(data.providers || {});
    } catch {
      setProviders({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const pingProvider = async (id) => {
    setPinging(id);
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer portofolio-fajar'
        },
        body: JSON.stringify({
          model: id,
          messages: [{ role: 'user', content: 'ping' }],
          temperature: 0.0
        })
      });
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        alert(`✅ ${id.toUpperCase()} Online! Respon diterima dalam ${latency}ms.`);
      } else {
        const err = await res.json();
        alert(`❌ ${id.toUpperCase()} Gagal: ${err.error?.message || 'Error'}`);
      }
      fetchHealth();
    } catch (e) {
      alert(`❌ Network error: ${e.message}`);
    } finally {
      setPinging(null);
    }
  };

  return (
    <div className="view-content health-view">
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Provider Health &amp; Latency Monitor</h2>
          <p>Status operasional dan performa real-time masing-masing AI Provider.</p>
        </div>
        <button className="save-btn" onClick={fetchHealth} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}>
          <RefreshCw size={15} /> Check Health
        </button>
      </div>

      <div className="keys-grid">
        {loading ? (
          <div style={{ color: '#94a3b8', padding: '2rem' }}>Memeriksa kesehatan provider...</div>
        ) : (
          Object.entries(providers).map(([id, info]) => {
            const h = info.health || {};
            const isOnline = info.key_configured;
            return (
              <div key={id} className="key-card">
                <div className="key-card-header" style={{ justifyContent: 'space-between' }}>
                  <h4>{info.display_name}</h4>
                  <span className={`status-badge ${isOnline ? 'ok' : 'error'}`}>
                    {isOnline ? 'Online' : 'No Key'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Success Rate:</span>
                    <span style={{ color: '#34d399', fontWeight: 700 }}>{h.success_rate || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Avg Latency:</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{h.avg_latency_ms ? `${h.avg_latency_ms}ms` : '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Requests:</span>
                    <span style={{ color: '#fff' }}>{h.total_requests || 0}</span>
                  </div>
                </div>
                <button 
                  className="save-btn" 
                  style={{ width: '100%', justifyContent: 'center', padding: '0.5rem', fontSize: '0.82rem' }}
                  onClick={() => pingProvider(id)}
                  disabled={pinging === id}
                >
                  <Zap size={14} /> {pinging === id ? 'Pinging...' : '⚡ Ping Live'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// --- NEW FEATURE 3: CACHE MANAGER VIEW ---
const CacheView = () => {
  const [stats, setStats] = useState({ hitRate: '0%', size: 0, maxSize: 100, hits: 0, misses: 0 });
  const [clearing, setClearing] = useState(false);

  const fetchCache = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/cache/stats`, {
        headers: { 'Authorization': 'Bearer portofolio-fajar' }
      });
      const data = await res.json();
      if (data.cache) setStats(data.cache);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetchCache();
  }, []);

  const handleClearCache = async () => {
    if (!confirm('Apakah Anda yakin ingin mengosongkan in-memory cache Naroot?')) return;
    setClearing(true);
    try {
      const res = await fetch(`${API_BASE}/v1/cache`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer portofolio-fajar' }
      });
      const data = await res.json();
      alert(`✅ ${data.message}`);
      fetchCache();
    } catch (e) {
      alert(`❌ Gagal mengosongkan cache: ${e.message}`);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="view-content cache-view">
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Cache Manager (LRU Cache)</h2>
          <p>In-memory cache untuk prompt identik; menghemat biaya token dan memangkas latensi menjadi ~1ms.</p>
        </div>
        <button className="save-btn" onClick={fetchCache} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}>
          <RefreshCw size={15} /> Refresh Stats
        </button>
      </div>

      <div className="metrics-row">
        <div className="metric-box">
          <p>Cache Hit Rate</p>
          <h3 className="success">{stats.hitRate}</h3>
        </div>
        <div className="metric-box">
          <p>Cached Entries</p>
          <h3>{stats.size} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>/ {stats.maxSize}</span></h3>
        </div>
        <div className="metric-box">
          <p>Cache Hits / Misses</p>
          <h3>{stats.hits} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>/ {stats.misses}</span></h3>
        </div>
      </div>

      <div className="key-card" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4>Kosongkan Seluruh Cache</h4>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '4px' }}>
            Aksi ini akan menghapus semua respon prompt yang tersimpan di memori backend.
          </p>
        </div>
        <button 
          className="save-btn" 
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#f87171' }}
          onClick={handleClearCache}
          disabled={clearing}
        >
          {clearing ? 'Clearing...' : 'Purge All Cache'}
        </button>
      </div>
    </div>
  );
};

const AnalyticsView = () => (
  <div className="view-content analytics-view">
    <div className="view-header">
      <h2>Usage Analytics</h2>
      <p>Statistik konsumsi token dan estimasi biaya per model.</p>
    </div>
    <div className="charts-grid">
      <div className="chart-card">
        <h3>Token Usage by Model</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={MOCK_CHART_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '8px', color: '#fff' }} />
              <Legend />
              <Bar dataKey="openai" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="gemini" fill="#38bdf8" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="claude" fill="#f97316" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="chart-card">
        <h3>Cost Trend (IDR)</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={MOCK_CHART_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <RechartsTooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '8px', color: '#fff' }} />
              <Legend />
              <Line type="monotone" dataKey="openai" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="gemini" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </div>
);

const LogsView = ({ history }) => (
  <div className="view-content logs-view">
    <div className="view-header">
      <h2>Request Logs</h2>
      <p>Real-time traffic monitor dari database Supabase.</p>
    </div>
    <div className="table-container">
      <table className="logs-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Status</th>
            <th>Model</th>
            <th>Latency</th>
            <th>Tokens</th>
            <th>Payload Snippet</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 ? (
            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Waiting for traffic...</td></tr>
          ) : (
            history.map(log => (
              <tr key={log.id} className="log-row">
                <td>{log.time}</td>
                <td>
                  <span className={`status-badge ${log.status === 200 ? 'ok' : 'error'}`}>
                    {log.status}
                  </span>
                </td>
                <td><span style={{ color: log.color, fontWeight: 600 }}>{log.model}</span></td>
                <td className={log.latency > 300 ? 'warning-text' : ''}>{log.latency}ms</td>
                <td className="monospace">{log.tokens}</td>
                <td className="payload-cell">
                  <code>{log.payload}</code>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const ChatbotView = () => {
  const [messages, setMessages] = useState([
    { id: 1, role: 'ai', text: 'Hello! I am Naroot. Send a message, and I will route it to the optimal AI model for you.', model: null }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [useStream, setUseStream] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), role: 'user', text: input, model: null };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const endpoint = `${API_BASE}/v1/chat/completions`;

      const startTime = performance.now();

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer portofolio-fajar'
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: input }],
          temperature: 0.7,
          stream: useStream
        })
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (useStream && response.ok) {
        let streamText = '';
        const aiMsgId = Date.now() + 1;
        setMessages(prev => [...prev, {
          id: aiMsgId,
          role: 'ai',
          text: '...',
          model: { name: 'Naroot Stream', color: '#38bdf8' }
        }]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  const delta = parsed.choices?.[0]?.delta?.content || '';
                  streamText += delta;
                  setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: streamText } : m));
                } catch {
                  // ignore
                }
              }
            }
          }
        }
        return;
      }

      const data = await response.json();
      
      let aiText = "Sorry, failed to get a response.";
      if (data.choices && data.choices[0] && data.choices[0].message) {
        aiText = data.choices[0].message.content;
      } else if (data.error) {
        aiText = `Error: ${data.error.message}`;
      }

      let respondedModelId = 'gemini';
      if (data.model && data.model.includes('claude')) respondedModelId = 'claude';
      else if (data.model && data.model.includes('gemini')) respondedModelId = 'gemini';
      else if (data.model && (data.model.includes('llama') || data.model.includes('groq') || data.model.includes('qwen/qwen3.8'))) respondedModelId = 'groq';
      else if (data.model && data.model.includes('gpt')) respondedModelId = 'openai';
      else if (data.model && data.model.includes('deepseek')) respondedModelId = 'deepseek';
      else if (data.model && data.model.includes('qwen')) respondedModelId = 'qwen';
      else if (selectedModel !== 'auto') respondedModelId = selectedModel;

      const aiMsg = { 
        id: Date.now() + 1, 
        role: 'ai', 
        text: aiText, 
        latency: latencyMs,
        cache: response.headers.get('X-Naroot-Cache') || 'MISS',
        model: AI_MODELS.find(m => m.id === respondedModelId) || { name: 'AI', color: '#38bdf8' }
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      const errorMsg = {
        id: Date.now() + 1,
        role: 'ai',
        text: `Error connecting to backend: ${error.message}`,
        model: { name: 'System', color: '#ef4444' }
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="view-content chatbot-view">
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>AI Playground</h2>
          <p>Test prompts and see how Naroot routes them in real-time.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={useStream} 
              onChange={e => setUseStream(e.target.checked)} 
              style={{ accentColor: '#38bdf8' }}
            />
            Stream SSE
          </label>
          <select 
            value={selectedModel} 
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#111827', color: '#fff', border: '1px solid rgba(148, 163, 184, 0.2)', outline: 'none' }}
          >
            <option value="auto">Auto (Naroot Decide)</option>
            <option value="gemini">Gemini 2.5 Flash</option>
            <option value="groq">Groq (Qwen / Llama)</option>
            <option value="openai">OpenAI (GPT-4o)</option>
            <option value="claude">Claude 3.5 Sonnet</option>
            <option value="deepseek">DeepSeek (V3)</option>
            <option value="qwen">Alibaba (Qwen Plus)</option>
          </select>
        </div>
      </div>
      
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`message-wrapper ${msg.role}`}>
              <div className={`message-bubble ${msg.role}`}>
                {msg.model && (
                  <div className="message-model-badge" style={{ color: msg.model.color, borderColor: msg.model.color }}>
                    <Zap size={12} /> {msg.model.name}
                    {msg.latency && <span style={{ marginLeft: '6px', opacity: 0.8 }}>&bull; {msg.latency}ms</span>}
                    {msg.cache && msg.cache === 'HIT' && <span style={{ marginLeft: '6px', color: '#34d399' }}>&bull; CACHE HIT</span>}
                  </div>
                )}
                <p>{msg.text}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="message-wrapper ai">
              <div className="message-bubble ai typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
        </div>
        
        <form className="chat-input-area" onSubmit={handleSend}>
          <input 
            type="text" 
            placeholder="Type your prompt here..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isTyping}
          />
          <button type="submit" disabled={!input.trim() || isTyping}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Login Component ---
const LoginView = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: '20px' }}>
            <NaralinkLogo scale={1.2} forceWhiteText={true} />
          </div>
          <p>Login to manage your AI API Proxy</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@domain.com" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Authenticating...' : (isRegistering ? 'Sign Up' : 'Secure Login')}
          </button>
        </form>
        <div className="login-footer">
          <button type="button" className="text-btn" onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? 'Already have an account? Login' : 'Need an account? Sign up'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---
function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [activeNode, setActiveNode] = useState('gemini');
  const [history, setHistory] = useState([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [apiKeys, setApiKeys] = useState({});
  const [routingStrategy, setRoutingStrategy] = useState('cost');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setIsCheckingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Real-time Supabase Fetching and Subscription
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchLogs = async () => {
      const { data: allData } = await supabase.from('api_logs').select('total_tokens, estimated_cost');
      if (allData) {
        const sumTokens = allData.reduce((acc, curr) => acc + (curr.total_tokens || 0), 0);
        const sumCost = allData.reduce((acc, curr) => acc + (curr.estimated_cost || 0), 0);
        setTotalTokens(sumTokens);
        setTotalCost(sumCost);
      }

      const { data } = await supabase.from('api_logs').select('*').order('created_at', { ascending: false }).limit(50);
      if (data) {
        const geminiAI = AI_MODELS.find(m => m.id === 'gemini');
        const formattedLogs = data.map(log => ({
          id: log.id,
          time: new Date(log.created_at).toLocaleTimeString(),
          model: log.model_name || 'Gemini',
          color: geminiAI?.color || '#38bdf8',
          tokens: log.total_tokens,
          latency: log.latency_ms,
          status: log.status_code,
          payload: log.payload
        }));
        setHistory(formattedLogs);
      }
    };

    fetchLogs();

    const subscription = supabase
      .channel('api_logs_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'api_logs' }, payload => {
        const newLog = payload.new;
        
        let matchedNodeId = 'gemini';
        if (newLog.model_name && newLog.model_name.includes('claude')) matchedNodeId = 'claude';
        else if (newLog.model_name && (newLog.model_name.includes('llama') || newLog.model_name.includes('qwen/qwen3.8'))) matchedNodeId = 'groq';
        else if (newLog.model_name && newLog.model_name.includes('gpt')) matchedNodeId = 'openai';
        else if (newLog.model_name && newLog.model_name.includes('deepseek')) matchedNodeId = 'deepseek';
        else if (newLog.model_name && newLog.model_name.includes('qwen')) matchedNodeId = 'qwen';
        else if (newLog.model_name && newLog.model_name.includes('gemini')) matchedNodeId = 'gemini';
        
        const aiModel = AI_MODELS.find(m => m.id === matchedNodeId);
        
        setActiveNode(matchedNodeId);

        setTotalTokens(prev => prev + (newLog.total_tokens || 0));
        setTotalCost(prev => prev + (newLog.estimated_cost || 0));

        const logEntry = {
          id: newLog.id,
          time: new Date(newLog.created_at).toLocaleTimeString(),
          model: newLog.model_name,
          color: aiModel?.color || '#38bdf8',
          tokens: newLog.total_tokens,
          latency: newLog.latency_ms,
          status: newLog.status_code,
          payload: newLog.payload
        };

        setHistory(prev => [logEntry, ...prev].slice(0, 50));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [isAuthenticated]);

  if (isCheckingAuth) {
    return <div className="app-container-full" style={{justifyContent: 'center', alignItems: 'center'}}><h2>Loading Secure Environment...</h2></div>;
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-container-full">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main className="main-content">
        <header className="top-header">
          <h1>{activeView.replace('_', ' ').toUpperCase()}</h1>
          <div className="user-profile">
            <button onClick={() => supabase.auth.signOut()} className="save-btn" style={{marginRight: '1rem', backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '0.5rem 1rem', fontSize: '0.85rem'}}>Logout</button>
            <div className="avatar">AD</div>
            <span>Admin Dashboard</span>
          </div>
        </header>

        <div className="scrollable-content">
          {activeView === 'dashboard' && (
            <DashboardView totalTokens={totalTokens} totalCost={totalCost} activeNode={activeNode} />
          )}
          {activeView === 'api_keys' && (
            <ApiKeysView apiKeys={apiKeys} setApiKeys={setApiKeys} />
          )}
          {activeView === 'chatbot' && (
            <ChatbotView />
          )}
          {activeView === 'routing' && (
            <RoutingView routingStrategy={routingStrategy} setRoutingStrategy={setRoutingStrategy} />
          )}
          {activeView === 'models' && (
            <ModelsView />
          )}
          {activeView === 'health' && (
            <HealthView />
          )}
          {activeView === 'cache' && (
            <CacheView />
          )}
          {activeView === 'analytics' && <AnalyticsView />}
          {activeView === 'logs' && <LogsView history={history} />}
        </div>
      </main>
    </div>
  );
}

export default App;
