import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, Zap, RefreshCw, Lock, Crown, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMarketStore } from '../store/marketStore';
import { useAuthStore } from '../store/authStore';
import { aiApi } from '../services/api';
import { localChat } from '../services/localStore';
import { cn } from '../utils/cn';

const QUICK_PROMPTS = [
  { label: 'Should I buy gold today?',          icon: '🥇' },
  { label: 'What is the oil price outlook?',    icon: '🛢️' },
  { label: 'Best stocks to watch this week',    icon: '📈' },
  { label: 'Explain current market sentiment',  icon: '🧠' },
  { label: 'Compare gold vs silver right now',  icon: '⚖️' },
  { label: "What is the Fed doing to markets?", icon: '🏦' },
];

interface Msg { id: string; role: 'user' | 'assistant'; content: string }

// ── Inline markdown formatter ─────────────────────────────────
function inlineFmt(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**'))
      return <strong key={i} className="font-bold text-white">{p.slice(2, -2)}</strong>;
    if (p.startsWith('*') && p.endsWith('*'))
      return <em key={i} className="italic text-gray-300">{p.slice(1, -1)}</em>;
    if (p.startsWith('`') && p.endsWith('`'))
      return <code key={i} className="font-mono text-[11px] bg-bg-4 text-gold px-1.5 py-0.5 rounded border border-border-light">{p.slice(1, -1)}</code>;
    return p;
  });
}

// ── Table renderer ────────────────────────────────────────────
function renderTable(lines: string[]): React.ReactNode {
  const parseRow = (line: string) =>
    line.split('|').map(c => c.trim()).filter((_, i, a) => i !== 0 && i !== a.length - 1);
  const headers = parseRow(lines[0]);
  const rows    = lines.slice(2).map(parseRow);
  return (
    <div className="overflow-x-auto my-2 rounded-lg border border-border/60">
      <table className="w-full min-w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-bg-4">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 text-gray-400 font-semibold uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={cn('border-b border-border/40 last:border-0', ri % 2 === 0 ? 'bg-bg-3/60' : 'bg-bg-2/60')}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-gray-300 font-mono whitespace-nowrap">
                  {inlineFmt(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Full markdown renderer ────────────────────────────────────
function renderMd(content: string) {
  const lines = content.split('\n');
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    // Table: row with | followed by separator |---|
    if (line.includes('|') && lines[i + 1]?.match(/^\|?[\s\-:|]+\|/)) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) { out.push(<div key={`t${i}`}>{renderTable(tableLines)}</div>); continue; }
    }

    // Headings
    if (line.startsWith('### ')) {
      out.push(<p key={i} className="text-[10px] font-bold uppercase tracking-widest text-gold/70 mt-3 mb-1">{inlineFmt(line.slice(4))}</p>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      out.push(<p key={i} className="text-sm font-bold text-white mt-3 mb-1">{inlineFmt(line.slice(3))}</p>);
      i++; continue;
    }

    // Unordered list
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) { items.push(lines[i].slice(2)); i++; }
      out.push(
        <ul key={`ul${i}`} className="my-1.5 space-y-1">
          {items.map((it, j) => (
            <li key={j} className="flex items-start gap-2 text-sm leading-relaxed">
              <span className="text-gold/60 mt-1.5 flex-shrink-0 text-[5px]">●</span>
              <span>{inlineFmt(it)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, '')); i++; }
      out.push(
        <ol key={`ol${i}`} className="my-1.5 space-y-1">
          {items.map((it, j) => (
            <li key={j} className="flex items-start gap-2 text-sm leading-relaxed">
              <span className="text-gold font-bold font-mono text-[11px] mt-0.5 w-4 flex-shrink-0">{j + 1}.</span>
              <span>{inlineFmt(it)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.trim() === '---') { out.push(<div key={i} className="border-t border-border my-2" />); i++; continue; }
    out.push(<p key={i} className="text-sm leading-relaxed">{inlineFmt(line)}</p>);
    i++;
  }
  return out;
}

function Bubble({ msg }: { msg: Msg }) {
  const isAI = msg.role === 'assistant';
  return (
    <div className={cn('flex gap-2 items-end w-full min-w-0', !isAI && 'flex-row-reverse')}>
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mb-0.5 shadow-md',
        isAI ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-bg'
             : 'bg-gradient-to-br from-violet-500 to-purple-700 text-white'
      )}>
        {isAI ? <Bot size={13} /> : 'U'}
      </div>
      <div className={cn(
        'max-w-[calc(100%-36px)] rounded-2xl px-3.5 py-2.5 border shadow-sm min-w-0 overflow-hidden',
        isAI ? 'bg-bg-3 border-border/60 text-gray-200 rounded-bl-sm'
             : 'bg-violet-600/20 border-violet-500/30 text-gray-100 rounded-br-sm'
      )}>
        {isAI
          ? <div className="space-y-1 overflow-x-auto w-full min-w-0 break-words">{renderMd(msg.content)}</div>
          : <p className="text-sm leading-relaxed break-words">{msg.content}</p>}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex gap-2 items-end">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center flex-shrink-0 mb-0.5 shadow-md">
        <Bot size={13} className="text-bg" />
      </div>
      <div className="bg-bg-3 border border-border/60 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 bg-gold/40 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Gate: non-pro users ───────────────────────────────────────
export function AIChat() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isPro    = user?.plan === 'pro' || user?.plan === 'enterprise';
  const isAdmin  = user?.is_admin === true;

  if (!isPro && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 bg-gold/10 border border-gold/20 rounded-2xl flex items-center justify-center mb-4">
          <Lock size={28} className="text-gold" />
        </div>
        <h2 className="text-xl font-bold mb-2">Pro Feature</h2>
        <p className="text-gray-400 text-sm mb-6 max-w-sm">
          AI Financial Assistant is available on the Pro plan. Upgrade to get access to Claude AI with live market context.
        </p>
        <button onClick={() => navigate('/settings?scroll=subscription')} className="btn-primary flex items-center gap-2 px-6 py-2.5">
          <Crown size={14} /> Upgrade to Pro — $20/mo
        </button>
        <p className="text-xs text-gray-600 mt-2">Sandbox mode · card 4242 4242 4242 4242</p>
      </div>
    );
  }

  return <AIChatContent userId={user!.id} />;
}

// ── Main chat UI ──────────────────────────────────────────────
function AIChatContent({ userId }: { userId: string }) {
  const { commodities, stocks } = useMarketStore();

  const [messages,    setMessages]    = useState<Msg[]>([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [contextOpen, setContextOpen] = useState(false); // mobile context panel
  const endRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const gold = commodities.find(c => c.symbol === 'XAU');
  const oil  = commodities.find(c => c.symbol === 'WTI');
  const nvda = stocks.find((s: any) => s.symbol === 'NVDA');

  const CONTEXT_ITEMS = [
    { label: 'Gold (XAU)',  value: `$${(gold?.price ?? 3327.40).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, chg: gold?.change_pct ?? 1.24,  color: '#f5c842' },
    { label: 'WTI Oil',    value: `$${(oil?.price  ?? 62.18).toFixed(2)}`,                                                 chg: oil?.change_pct  ?? -0.41, color: '#4fc3f7' },
    { label: 'NVIDIA',     value: `$${(nvda?.price ?? 872.20).toFixed(2)}`,                                                chg: nvda?.change_pct ?? 2.14,  color: '#4ade80' },
    { label: 'USD Index',  value: '104.2', chg:  0.1, color: '#9ca3af' },
    { label: 'Fed Rate',   value: '5.25%', chg:  0,   color: '#9ca3af' },
    { label: 'VIX',        value: '18.4',  chg: -2.1, color: '#a78bfa' },
  ];

  // Load saved / seed welcome message
  useEffect(() => {
    const saved = localChat.get(userId);
    if (saved.length > 0) {
      setMessages(saved.map((m, i) => ({ id: `s-${i}`, role: m.role as 'user' | 'assistant', content: m.content })));
    } else {
      setMessages([{
        id: 'welcome', role: 'assistant',
        content: `Hello! I'm NexusAI — your AI financial assistant.\n\nLive data I can see:\n**Gold (XAU):** $${(gold?.price ?? 3327.40).toLocaleString()} (${(gold?.change_pct ?? 1.24) >= 0 ? '+' : ''}${(gold?.change_pct ?? 1.24).toFixed(2)}%)\n**WTI Oil:** $${(oil?.price ?? 62.18).toFixed(2)} (${(oil?.change_pct ?? -0.41).toFixed(2)}%)\n\nAsk me anything about markets, predictions, or investment strategy!`,
      }]);
    }
  }, [userId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const userMsg: Msg = { id: Date.now().toString(), role: 'user', content };
    const history = [...messages.filter(m => m.id !== 'welcome'), userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);
    localChat.append(userId, { role: 'user', content });
    try {
      const reply = await aiApi.chat(history.slice(-10).map(({ role, content }) => ({ role, content })));
      const replyMsg: Msg = { id: `r-${Date.now()}`, role: 'assistant', content: reply };
      setMessages(prev => [...prev, replyMsg]);
      localChat.append(userId, { role: 'assistant', content: reply });
    } catch (err: any) {
      const errContent =
        err.message?.includes('401') ? '❌ Session expired. Please sign in again.' :
        err.message?.includes('429') ? '⚠️ Rate limit. Wait a moment and try again.' :
        `❌ Error: ${err.message}`;
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: errContent }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  }, [input, loading, messages]);

  function clearChat() {
    localChat.clear(userId);
    setMessages([{ id: 'c', role: 'assistant', content: 'Chat cleared. How can I help you?' }]);
  }

  // ── Right-side context panel (shared between desktop inline + mobile drawer) ──
  const ContextPanel = (
    <div className="space-y-4">
      {/* Live context */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} className="text-gold" />
          <p className="section-label">Live Context</p>
          <span className="badge-gold ml-auto">AI Uses This</span>
        </div>
        <div className="font-mono text-xs space-y-0">
          {CONTEXT_ITEMS.map(item => (
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

      {/* Quick questions */}
      <div className="card">
        <p className="section-label mb-3">Quick Questions</p>
        <div className="space-y-2">
          {QUICK_PROMPTS.map(q => (
            <button key={q.label} onClick={() => { send(q.label); setContextOpen(false); }} disabled={loading}
              className="w-full text-left text-xs sm:text-sm bg-bg-3 hover:bg-bg-4 border border-border hover:border-gold text-gray-400 hover:text-white px-3 py-2 rounded-lg transition-all disabled:opacity-40 flex items-center gap-2">
              <span className="flex-shrink-0">{q.icon}</span>
              <span className="truncate">{q.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-3">
        <div>
          <h1 className="page-title">AI Financial Assistant</h1>
          <p className="page-sub">Powered by Claude AI · live market context · history persists</p>
        </div>

      </div>



      <div className="grid lg:grid-cols-3 gap-4 sm:gap-5 items-start">
        {/* ── Chat window ── */}
        <div className="lg:col-span-2 card flex flex-col h-[480px] sm:h-[540px] lg:h-[600px] overflow-hidden min-w-0">
          {/* Chat header */}
          <div className="flex items-center justify-between pb-3 border-b border-border mb-3 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bot size={15} className="text-bg" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">NexusAI Assistant</p>
                <p className="text-[10px] text-gray-500 hidden sm:block">Claude AI · live market context</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-green-400 font-mono">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full live-dot" />
                Connected
              </span>
              <button onClick={clearChat} className="btn-ghost text-xs flex items-center gap-1 px-2 py-1">
                <RefreshCw size={10} />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 pr-1 min-h-0 w-full">
            {messages.map(m => <Bubble key={m.id} msg={m} />)}
            {loading && <Typing />}
            <div ref={endRef} />
          </div>

          {/* Quick prompt chips — scrollable row */}
          <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-border flex-shrink-0 overflow-x-auto scrollbar-none pb-1 -mx-0.5 px-0.5">
            {QUICK_PROMPTS.slice(0, 4).map(q => (
              <button key={q.label} onClick={() => send(q.label)} disabled={loading}
                className="text-xs bg-bg-3 hover:bg-bg-4 border border-border-light hover:border-gold text-gray-400 hover:text-gold px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40 whitespace-nowrap flex-shrink-0">
                {q.icon} {q.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2 mt-2 flex-shrink-0">
            <input
              ref={inputRef}
              className="input flex-1 text-sm"
              placeholder="Ask about gold, oil, stocks, crypto…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              disabled={loading}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="bg-gold hover:bg-gold-dark text-bg px-3.5 rounded-lg transition-all disabled:opacity-40 flex items-center flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        </div>

        {/* ── Desktop: context panel (right column) ── */}
        <div className="hidden lg:block">{ContextPanel}</div>
      </div>

      {/* ── Mobile: context panel (below chat, collapsible) ── */}
      <div className="lg:hidden mt-4">
        <button
          onClick={() => setContextOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-bg-3 border border-border rounded-xl text-sm font-semibold text-gray-300 hover:text-white transition-colors mb-2"
        >
          <div className="flex items-center gap-2">
            <Zap size={13} className="text-gold" />
            Live Market Context &amp; Quick Questions
          </div>
          <ChevronDown size={14} className={cn('transition-transform text-gray-500', contextOpen && 'rotate-180')} />
        </button>
        {contextOpen && <div>{ContextPanel}</div>}
      </div>
    </div>
  );
}
