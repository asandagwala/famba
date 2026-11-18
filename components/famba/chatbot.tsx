"use client";

import { useEffect, useRef, useState } from "react";
import { KenteStripe, Mark } from "./ui";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = ["Who hasn't paid me yet?", "How much can I settle today?", "How much have I saved on fees?", "What's the rand to shilling rate?"];

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hello. Ask me anything about your payments, balance, suppliers or exchange rates." },
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
        <div className="fixed inset-x-3 bottom-[76px] z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-lg border border-rule bg-paper shadow-2xl sm:inset-x-auto sm:right-6 sm:w-[380px]">
          <div className="flex items-center justify-between bg-night px-5 py-4 text-ivory">
            <div>
              <p className="font-display text-[17px] font-semibold">Famba Assistant</p>
              <p className="text-[12px] text-ivory/55">Reads your data. Never moves money.</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-[13px] text-ivory/60 hover:text-ivory" aria-label="Close chat">
              Close
            </button>
          </div>
          <KenteStripe />
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-[14px] leading-relaxed ${m.role === "user" ? "bg-night text-ivory" : "bg-ivory text-ink"}`}>
                  {m.content}
                </p>
              </div>
            ))}
            {busy && <p className="w-fit rounded-lg bg-ivory px-3.5 py-2.5 text-[14px] text-stone">Looking that up…</p>}
            {messages.length === 1 && (
              <div className="space-y-1.5 pt-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="block w-full rounded-md border border-rule bg-white px-3 py-2 text-left text-[13px] hover:border-night-3">
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
            className="flex gap-2 border-t border-rule p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your money…"
              className="flex-1 rounded-md border border-rule bg-white px-3 py-2 text-[14px] outline-none focus:border-night-3"
              aria-label="Message the Famba Assistant"
            />
            <button disabled={busy || !input.trim()} className="rounded-sm bg-night px-4 text-[14px] font-semibold text-white hover:bg-night-3 disabled:opacity-50">
              Send
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-md bg-night py-2.5 pl-2.5 pr-4 text-[14px] font-semibold text-ivory shadow-xl ring-1 ring-white/20 hover:bg-night-3 sm:right-6"
        aria-label={open ? "Close Famba Assistant" : "Open Famba Assistant"}
      >
        <Mark size={24} />
        {open ? "Close assistant" : "Ask Famba"}
      </button>
    </>
  );
}
