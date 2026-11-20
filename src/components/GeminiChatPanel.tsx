import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Trash2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';

interface MessageItem {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
}

const MODEL_OPTIONS = [
  { id: 'gemini-4-hydrogen', label: 'Umum & Refleksi (Gemini 4 Hydrogen)' },
  { id: 'gemini-3.1-flash-lite', label: 'Cepat & Ringkas (Gemini 3.1 Flash Lite)' },
  { id: 'gemini-4-carbon', label: 'Analisis Mendalam (Gemini 4 Carbon)' },
  { id: 'gemini-4-neon', label: 'Perencanaan Terstruktur (Gemini 4 Neon)' },
];

export function GeminiChatPanel({
  userRoleLabel,
  defaultPrompts,
}: {
  userRoleLabel: string;
  defaultPrompts: string[];
}) {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `Halo! Saya Teman Refleksi DIGITAL BALANCE (${userRoleLabel}). Ceritakan kebiasaan media sosial, tantangan manajemen waktu, atau ide refleksi yang ingin kamu diskusikan hari ini. Ingat, percakapan ini bersifat pendampingan refleksi dan tidak menggantikan sesi langsung bersama Guru BK.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('gemini-4-hydrogen');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(textToSend?: string) {
    const clean = (textToSend ?? input).trim();
    if (!clean || loading) return;

    const userMsg: MessageItem = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: clean,
    };

    const historyPayload = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch<{ reply: string; model: string }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: clean,
          history: historyPayload,
          model,
        }),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `m_${Date.now()}`,
          role: 'model',
          text: res.reply,
          modelUsed: res.model,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghubungi asisten.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col h-[620px]">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Teman Refleksi AI</h2>
          <p className="text-xs text-slate-500">
            Percakapan multi-putaran dengan riwayat sesi untuk refleksi kebiasaan digital
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            aria-label="Pilih model asisten"
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setMessages([messages[0]]);
              setError(null);
            }}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            title="Bersihkan percakapan"
            aria-label="Bersihkan percakapan"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Thread */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/60">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                msg.role === 'user'
                  ? 'bg-violet-700 text-white'
                  : 'bg-white border border-slate-200 text-violet-700'
              }`}
            >
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div
              className={`max-w-[82%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-violet-700 text-white'
                  : 'bg-white border border-slate-200 text-slate-800'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-violet-700 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500">
              Menyusun tanggapan refleksi...
            </div>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      {error && (
        <div className="mx-5 mt-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Prompts */}
      <div className="px-5 pt-3 flex flex-wrap gap-2">
        {defaultPrompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => sendMessage(p)}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-violet-50 hover:text-violet-800 text-slate-700 rounded-lg transition-colors text-left"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="p-4 border-t border-slate-200 mt-3 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tulis pertanyaan atau refleksi Anda..."
          className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 disabled:opacity-50 shrink-0"
        >
          <Send className="w-4 h-4" />
          <span>Kirim</span>
        </button>
      </form>
    </div>
  );
}
