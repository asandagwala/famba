"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What's my balance?",
  "Who hasn't paid me yet?",
  "How much have I saved on fees?",
  "What's today's rand to shilling rate?",
];

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm the Famba Assistant. Ask me about your payments, balance, suppliers or exchange rates." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(1) }), // skip the greeting
      });
      const body = await res.json();
      setMessages([...next, { role: "assistant", content: body.reply ?? body.error ?? "Something went wrong." }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "I can't reach the server right now." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed inset-x-3 bottom-20 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-3xl border border-[#EDE2D6] bg-white shadow-2xl sm:inset-x-auto sm:right-6 sm:w-[380px]">
          <div className="flex items-center justify-between bg-[#181412] px-4 py-3 text-white">
            <div>
              <p className="font-bold">Famba Assistant</p>
              <p className="text-[11px] text-white/60">Reads your data · never moves money</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-white/70 hover:text-white" aria-label="Close chat">
              ✕
            </button>
          </div>
          <div className="h-1 bg-gradient-to-r from-[#C84B24] via-[#E59A18] to-[#1E6B45]" />
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <p
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                    m.role === "user" ? "rounded-br-sm bg-[#C84B24] text-white" : "rounded-bl-sm bg-[#FFF8EE] text-[#181412]"
                  }`}
                >
                  {m.content}
                </p>
              </div>
            ))}
            {busy && <p className="w-fit rounded-2xl rounded-bl-sm bg-[#FFF8EE] px-3.5 py-2 text-sm text-[#685D55]">Looking that up…</p>}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="rounded-full border border-[#EDE2D6] px-3 py-1.5 text-xs font-semibold hover:border-[#C84B24] hover:text-[#C84B24]">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={end} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex gap-2 border-t border-[#EDE2D6] p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your money…"
              className="flex-1 rounded-xl border border-[#E8DCD0] px-3 py-2 text-sm outline-none focus:border-[#C84B24]"
              aria-label="Message the Famba Assistant"
            />
            <button disabled={busy || !input.trim()} className="rounded-xl bg-[#C84B24] px-4 text-sm font-bold text-white disabled:opacity-50">
              Send
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#181412] px-5 py-3.5 font-bold text-white shadow-xl hover:bg-[#C84B24] sm:right-6"
        aria-label="Open Famba Assistant"
      >
        <span className="text-lg">💬</span> {open ? "Close" : "Ask Famba"}
      </button>
    </>
  );
}
