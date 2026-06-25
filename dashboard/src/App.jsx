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
  Send
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';
import './App.css';

const AI_MODELS = [
  { id: 'openai', name: 'OpenAI GPT-4o', color: '#10b981' },
  { id: 'gemini', name: 'Gemini 1.5 Pro', color: '#3b82f6' },
  { id: 'claude', name: 'Claude 3.5 Sonnet', color: '#f97316' },
  { id: 'llama', name: 'Llama 3', color: '#8b5cf6' },
  { id: 'mistral', name: 'Mistral Large', color: '#eab308' },
  { id: 'cohere', name: 'Cohere Command', color: '#ec4899' },
  { id: 'qwen', name: 'Qwen Max', color: '#06b6d4' },
  { id: 'yi', name: 'Yi Large', color: '#ef4444' }
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

// --- Sub-Components Moved Outside to Prevent Re-mounting (Flickering) ---

const Sidebar = ({ activeView, setActiveView }) => (
  <aside className="sidebar">
    <div className="sidebar-logo">
      <div className="logo-icon-bg">
        <Zap className="logo-icon" size={24} color="#ffffff" />
      </div>
      <h2>9Router</h2>
    </div>
    <nav className="sidebar-nav">
      <button className={activeView === 'dashboard' ? 'active' : ''} onClick={() => setActiveView('dashboard')}>
        <LayoutDashboard size={20} /> Dashboard
      </button>
      <button className={activeView === 'api_keys' ? 'active' : ''} onClick={() => setActiveView('api_keys')}>
        <KeyRound size={20} /> API Keys
      </button>
      <button className={activeView === 'chatbot' ? 'active' : ''} onClick={() => setActiveView('chatbot')}>
        <Bot size={20} /> Playground
      </button>
      <button className={activeView === 'routing' ? 'active' : ''} onClick={() => setActiveView('routing')}>
        <Settings2 size={20} /> Routing Strategy
      </button>
      <button className={activeView === 'analytics' ? 'active' : ''} onClick={() => setActiveView('analytics')}>
        <BarChart3 size={20} /> Analytics
      </button>
      <button className={activeView === 'logs' ? 'active' : ''} onClick={() => setActiveView('logs')}>
        <Terminal size={20} /> Request Logs
      </button>
    </nav>
    <div className="sidebar-footer">
      <Activity size={16} className="pulse-icon" /> System Online
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

          return (
            <g key={`line-${model.id}`}>
              <line x1={centerX} y1={centerY} x2={x} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
              {isActive && (
                <line x1={centerX} y1={centerY} x2={x} y2={y} stroke={model.color} strokeWidth="3" filter="url(#glow)" className="energy-line" />
              )}
              {isActive && (
                <circle cx={centerX} cy={centerY} r="4" fill={model.color} filter="url(#glow)">
                  <animate attributeName="cx" values={`${centerX};${x}`} dur="0.8s" repeatCount="indefinite" />
                  <animate attributeName="cy" values={`${centerY};${y}`} dur="0.8s" repeatCount="indefinite" />
                </circle>
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
              <circle r={isActive ? "28" : "24"} fill="#1e293b" stroke={isActive ? model.color : "#334155"} strokeWidth={isActive ? "3" : "2"} filter={isActive ? "url(#glow)" : ""} className="ai-node" />
              <text y="-35" textAnchor="middle" fill={isActive ? model.color : "#94a3b8"} fontSize="12" fontWeight={isActive ? "700" : "500"} filter={isActive ? "url(#glow)" : ""}>
                {model.name}
              </text>
              <circle r="6" fill={isActive ? model.color : "#64748b"} />
            </g>
          );
        })}

        <g transform={`translate(${centerX}, ${centerY})`}>
          <circle r="45" fill="#0f172a" stroke="#ffffff" strokeWidth="2" className="center-node-bg" />
          <text y="5" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="bold">9Router</text>
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
        <p>Estimated Cost Savings</p>
        <h3 className="success">${totalCost.toFixed(2)}</h3>
      </div>
      <div className="metric-box">
        <p>Active Model (Ping)</p>
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

const ApiKeysView = ({ apiKeys, setApiKeys }) => (
  <div className="view-content api-keys-view">
    <div className="view-header">
      <h2>Provider API Keys</h2>
      <p>Manage your keys securely. 9Router uses these to forward your requests.</p>
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
    <button className="save-btn"><Save size={18} /> Save Configuration</button>
  </div>
);

const RoutingView = ({ routingStrategy, setRoutingStrategy }) => (
  <div className="view-content routing-view">
    <div className="view-header">
      <h2>Routing Strategy</h2>
      <p>Configure how 9Router decides which AI model to use.</p>
    </div>
    <div className="strategy-cards">
      <div className={`strategy-card ${routingStrategy === 'cost' ? 'selected' : ''}`} onClick={() => setRoutingStrategy('cost')}>
        <div className="icon-wrapper"><CheckCircle2 color={routingStrategy === 'cost' ? '#3b82f6' : '#64748b'} /></div>
        <h3>Cost Optimized</h3>
        <p>Routes to the cheapest available model that meets your prompt requirements.</p>
      </div>
      <div className={`strategy-card ${routingStrategy === 'speed' ? 'selected' : ''}`} onClick={() => setRoutingStrategy('speed')}>
        <div className="icon-wrapper"><CheckCircle2 color={routingStrategy === 'speed' ? '#3b82f6' : '#64748b'} /></div>
        <h3>Speed Optimized</h3>
        <p>Routes to the model with the lowest current latency.</p>
      </div>
      <div className={`strategy-card ${routingStrategy === 'fallback' ? 'selected' : ''}`} onClick={() => setRoutingStrategy('fallback')}>
        <div className="icon-wrapper"><CheckCircle2 color={routingStrategy === 'fallback' ? '#3b82f6' : '#64748b'} /></div>
        <h3>High Availability (Fallback)</h3>
        <p>Uses preferred model, falls back to alternatives if a 500 error occurs.</p>
      </div>
    </div>
  </div>
);

const AnalyticsView = () => (
  <div className="view-content analytics-view">
    <div className="view-header">
      <h2>Usage Analytics</h2>
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
              <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
              <Legend />
              <Bar dataKey="openai" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="gemini" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="claude" fill="#f97316" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="chart-card">
        <h3>Cost Trend (USD)</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={MOCK_CHART_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
              <Legend />
              <Line type="monotone" dataKey="openai" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="gemini" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
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
      <p>Real-time traffic monitor.</p>
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
    { id: 1, role: 'ai', text: 'Hello! I am 9Router. Send a message, and I will route it to the optimal AI model for you.', model: null }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), role: 'user', text: input, model: null };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('http://localhost:8080/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gemini',
          messages: [{ role: 'user', content: input }],
          temperature: 0.7
        })
      });

      const data = await response.json();
      
      let aiText = "Sorry, failed to get a response.";
      if (data.choices && data.choices[0] && data.choices[0].message) {
        aiText = data.choices[0].message.content;
      } else if (data.error) {
        aiText = `Error: ${data.error.message}`;
      }

      const aiMsg = { 
        id: Date.now() + 1, 
        role: 'ai', 
        text: aiText, 
        model: AI_MODELS.find(m => m.id === 'gemini') || { name: 'Gemini', color: '#3b82f6' }
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
      <div className="view-header">
        <h2>AI Playground</h2>
        <p>Test prompts and see how 9Router handles them in real-time.</p>
      </div>
      
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`message-wrapper ${msg.role}`}>
              <div className={`message-bubble ${msg.role}`}>
                {msg.model && (
                  <div className="message-model-badge" style={{ color: msg.model.color, borderColor: msg.model.color }}>
                    <Zap size={12} /> {msg.model.name}
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

// --- Main App Component ---
function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [activeNode, setActiveNode] = useState(null);
  const [history, setHistory] = useState([]);
  const [totalTokens, setTotalTokens] = useState(1245000);
  const [totalCost, setTotalCost] = useState(14.50); // USD
  const [apiKeys, setApiKeys] = useState({});
  const [routingStrategy, setRoutingStrategy] = useState('cost');

  // Simulator Effect
  useEffect(() => {
    const interval = setInterval(() => {
      const randomAI = AI_MODELS[Math.floor(Math.random() * AI_MODELS.length)];
      setActiveNode(randomAI.id);

      const tokensUsed = Math.floor(Math.random() * 800) + 50;
      const latency = Math.floor(Math.random() * 400) + 100;
      const status = Math.random() > 0.95 ? 500 : 200; // 5% chance of error

      setTotalTokens(prev => prev + tokensUsed);
      setTotalCost(prev => prev + (tokensUsed * 0.00002));

      const logEntry = {
        id: Date.now(),
        time: new Date().toLocaleTimeString(),
        model: randomAI.name,
        color: randomAI.color,
        tokens: tokensUsed,
        latency: latency,
        status: status,
        payload: `{"prompt": "Hello world from ${randomAI.name}..."}`
      };

      setHistory(prev => [logEntry, ...prev].slice(0, 50));

      setTimeout(() => setActiveNode(null), 1500);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-container-full">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main className="main-content">
        <header className="top-header">
          <h1>{activeView.replace('_', ' ').toUpperCase()}</h1>
          <div className="user-profile">
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
          {activeView === 'analytics' && <AnalyticsView />}
          {activeView === 'logs' && <LogsView history={history} />}
        </div>
      </main>
    </div>
  );
}

export default App;
