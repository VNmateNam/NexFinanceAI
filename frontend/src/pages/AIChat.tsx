import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, Zap, RefreshCw, Lock, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMarketStore } from '../store/marketStore';
import { useAuthStore } from '../store/authStore';
import { aiApi } from '../services/api';
import { localChat } from '../services/localStore';
import { cn } from '../utils/cn';

const QUICK_PROMPTS = [
  { label: 'Should I buy gold today?',        icon: '🥇' },
  { label: 'What is the oil price outlook?',  icon: '🛢️' },
  { label: 'Best stocks to watch this week',  icon: '📈' },
  { label: 'Explain current market sentiment',icon: '🧠' },
  { label: 'Compare gold vs silver right now',icon: '⚖️' },
  { label: 'What is the Fed doing to markets?',icon: '🏦' },
];

interface Msg { id: string; role: 'user' | 'assistant'; content: string }

function Bubble({ msg }: { msg: Msg }) {
  const isAI = msg.role === 'assistant';
  return (
    <div className={cn('flex gap-3 items-start', !isAI && 'flex-row-reverse')}>
      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5',
        isAI ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-bg'
             : 'bg-gradient-to-br from-violet-500 to-purple-700 text-white')}>
        {isAI ? <Bot size={13} /> : 'U'}
      </div>
      <div className={cn('max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed border',
        isAI ? 'bg-bg-3 border-border text-gray-200' : 'bg-violet-500/15 border-violet-500/30 text-gray-200')}>
        {msg.content.split('\n').map((line, i) => (
          <p key={i} className={i > 0 ? 'mt-1.5' : ''}>
            {line.split(/(\*\*[^*]+\*\*)/).map((p, j) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={j} className="text-white font-bold">{p.slice(2,-2)}</strong>
                : p)}
          </p>
        ))}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center flex-shrink-0">
        <Bot size={13} className="text-bg" />
      </div>
      <div className="bg-bg-3 border border-border rounded-xl px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay:`${i*0.15}s` }} />)}
        </div>
      </div>
    </div>
  );
}

export function AIChat() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isPro = user?.plan === 'pro' || user?.plan === 'enterprise';

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 bg-gold/10 border border-gold/20 rounded-2xl flex items-center justify-center mb-4">
          <Lock size={28} className="text-gold" />
        </div>
        <h2 className="text-xl font-bold mb-2">Pro Feature</h2>
        <p className="text-gray-400 text-sm mb-6 max-w-sm">
          AI Financial Assistant is available on the Pro plan. Upgrade to get access to Claude AI with live market context.
        </p>
        <button onClick={() => navigate('/settings')}
          className="btn-primary flex items-center gap-2 px-6 py-2.5">
          <Crown size={14} /> Upgrade to Pro — $20/mo
        </button>
        <p className="text-xs text-gray-600 mt-2">Sandbox mode · card 4242 4242 4242 4242</p>
      </div>
    );
  }

  return <AIChatContent />;
}

function AIChatContent() {
  const { commodities, stocks } = useMarketStore();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const endRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load persisted chat
  useEffect(() => {
    const saved = localChat.get();
    if (saved.length > 0) {
      setMessages(saved.map((m,i) => ({ id:`s-${i}`, role: m.role as 'user'|'assistant', content: m.content })));
    } else {
      const gold = commodities.find(c => c.symbol === 'XAU');
      const oil  = commodities.find(c => c.symbol === 'WTI');
      setMessages([{
        id: 'welcome', role: 'assistant',
        content: `Hello! I'm NexusAI — your AI financial assistant.\n\nLive data I can see:\n**Gold (XAU):** $${(gold?.price??3327.40).toLocaleString()} (${(gold?.change_pct??1.24)>=0?'+':''}${(gold?.change_pct??1.24).toFixed(2)}%)\n**WTI Oil:** $${(oil?.price??62.18).toFixed(2)} (${(oil?.change_pct??-0.41).toFixed(2)}%)\n\nAsk me anything about markets, predictions, or investment strategy!`,
      }]);
    }
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const saveKey = (_k: string) => {};  // no-op, kept for compat

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Msg = { id: Date.now().toString(), role: 'user', content };
    const history = [...messages.filter(m => m.id !== 'welcome'), userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);
    localChat.append({ role: 'user', content });

    try {
      const reply = await aiApi.chat(history.slice(-10).map(({ role, content }) => ({ role, content })));
      const replyMsg: Msg = { id: `r-${Date.now()}`, role: 'assistant', content: reply };
      setMessages(prev => [...prev, replyMsg]);
      localChat.append({ role: 'assistant', content: reply });
    } catch (err: any) {
      const errContent = err.message?.includes('401')
        ? '❌ Session expired. Please sign in again.'
        : err.message?.includes('429')
        ? '⚠️ Rate limit. Wait a moment and try again.'
        : `❌ Error: ${err.message}`;
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: errContent }]);
    }

    setLoading(false);
    inputRef.current?.focus();
  }, [input, loading, messages]);

  function clearChat() {
    localChat.clear();
    setMessages([{ id:'c', role:'assistant', content:'Chat cleared. How can I help you?' }]);
  }

  const gold = commodities.find(c => c.symbol === 'XAU');
  const oil  = commodities.find(c => c.symbol === 'WTI');
  const nvda = stocks.find((s: any) => s.symbol === 'NVDA');

  return (
    <div>
      <h1 className="page-title">AI Financial Assistant</h1>
      <p className="page-sub">Powered by Claude AI · live market context · chat history persists</p>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Chat */}
        <div className="lg:col-span-2 card flex flex-col" style={{ height: 600 }}>
          <div className="flex items-center justify-between pb-3 border-b border-border mb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
                <Bot size={16} className="text-bg" />
              </div>
              <div>
                <p className="text-sm font-bold">NexusAI Assistant</p>
                <p className="text-[10px] text-gray-500">Claude AI · live market context</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full live-dot"/>
              <span className="text-xs text-green-400 font-mono">Connected</span>
              <button onClick={clearChat} className="btn-ghost text-xs ml-1 flex items-center gap-1">
                <RefreshCw size={11}/> Clear
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
            {messages.map(m => <Bubble key={m.id} msg={m} />)}
            {loading && <Typing />}
            <div ref={endRef} />
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-border flex-shrink-0">
            {QUICK_PROMPTS.slice(0, 4).map(q => (
              <button key={q.label} onClick={() => send(q.label)} disabled={loading}
                className="text-xs bg-bg-3 hover:bg-bg-4 border border-border-light hover:border-gold text-gray-400 hover:text-gold px-2.5 py-1 rounded-lg transition-all disabled:opacity-40">
                {q.icon} {q.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mt-2 flex-shrink-0">
            <input ref={inputRef} className="input flex-1"
              placeholder="Ask about gold, oil, stocks…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              disabled={loading} />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              className="bg-gold hover:bg-gold-dark text-bg px-4 rounded-lg transition-all disabled:opacity-40 flex items-center font-bold text-sm flex-shrink-0">
              <Send size={14} />
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={13} className="text-gold" />
              <p className="section-label">Live Context</p>
              <span className="badge-gold ml-auto">AI Uses This</span>
            </div>
            <div className="space-y-0 font-mono text-xs">
              {[
                { label: 'Gold (XAU)',  value:`$${(gold?.price??3327.40).toLocaleString(undefined,{maximumFractionDigits:2})}`, chg: gold?.change_pct??1.24,  color:'#f5c842' },
                { label: 'WTI Oil',    value:`$${(oil?.price??62.18).toFixed(2)}`,                                              chg: oil?.change_pct??-0.41, color:'#4fc3f7' },
                { label: 'NVIDIA',     value:`$${(nvda?.price??872.20).toFixed(2)}`,                                            chg: nvda?.change_pct??2.14, color:'#4ade80' },
                { label: 'USD Index',  value:'104.2', chg: 0.1,  color:'#9ca3af' },
                { label: 'Fed Rate',   value:'5.25%', chg: 0,    color:'#9ca3af' },
                { label: 'VIX',        value:'18.4',  chg:-2.1,  color:'#a78bfa' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <span className="text-gray-500">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span style={{ color: item.color }} className="font-bold">{item.value}</span>
                    <span className={item.chg >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {item.chg >= 0 ? '▲' : '▼'}{Math.abs(item.chg).toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <p className="section-label mb-3">Quick Questions</p>
            <div className="space-y-2">
              {QUICK_PROMPTS.map(q => (
                <button key={q.label} onClick={() => send(q.label)} disabled={loading}
                  className="w-full text-left text-sm bg-bg-3 hover:bg-bg-4 border border-border hover:border-gold text-gray-400 hover:text-white px-3 py-2.5 rounded-lg transition-all disabled:opacity-40 flex items-center gap-2">
                  <span>{q.icon}</span><span>{q.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
