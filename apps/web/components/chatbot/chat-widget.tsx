"use client";

import { useCallback, useEffect, useState } from "react";

type Branding = { primary_color?: string; position?: "left" | "right" };
type ChatView = { conversationId: string; assistantName: string; node: { type: string; content: string; captureType: string | null }; options: { id: string; label: string }[]; messages: { sender: string; content: string }[]; status: string; branding: string | number | boolean | null | Branding | unknown[]; routeHint?: string };

function sessionKey(widgetId: string) { return `ltr_chat_session_${widgetId}`; }
function renewSessionId(widgetId: string) { const value = crypto.randomUUID(); sessionStorage.setItem(sessionKey(widgetId), value); return value; }
function sessionId(widgetId: string) { return sessionStorage.getItem(sessionKey(widgetId)) ?? renewSessionId(widgetId); }
function brandingOf(value: ChatView["branding"]): Branding { return value && typeof value === "object" && !Array.isArray(value) ? value as Branding : {}; }

export function ChatWidget({ widgetId, floating = false, endpoint = "/api/chatbot" }: { widgetId: string; floating?: boolean; endpoint?: string }) {
  const [view, setView] = useState<ChatView | null>(null);
  const [open, setOpen] = useState(!floating);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const call = useCallback(async (body: Record<string, unknown>) => {
    setError("");
    const activeSessionId = body.action === "restart" ? renewSessionId(widgetId) : sessionId(widgetId);
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ widgetId, sessionId: activeSessionId, ...body }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Chat is unavailable."); return; }
    setView(data);
  }, [endpoint, widgetId]);
  useEffect(() => {
    if (!open || view) return;
    const timer = window.setTimeout(() => { void call({ action: "start" }); }, 0);
    return () => window.clearTimeout(timer);
  }, [call, open, view]);

  const branding = brandingOf(view?.branding ?? null);
  const primary = branding.primary_color ?? "#2563eb";
  const position = branding.position === "left" ? "left-5" : "right-5";
  const assistantName = view?.assistantName ?? "Website assistant";

  return <div className={floating ? `fixed bottom-5 ${position} z-50` : "mx-auto w-full max-w-sm p-3"}>
    {floating && !open ? <div className="flex flex-col items-end gap-2"><span className="rounded-full bg-white px-3 py-1.5 text-xs text-slate-600 shadow">Need help?</span><button aria-label="Open chat" className="flex h-14 w-14 items-center justify-center rounded-full text-2xl font-semibold text-white shadow-lg transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-200" onClick={() => setOpen(true)} style={{ backgroundColor: primary }}>◌</button></div> : null}
    {open && <section aria-label={`${assistantName} chat`} className="w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-200">
      <header className="flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: primary }}><div><strong>{assistantName}</strong><p className="text-xs text-white/85">Usually replies instantly</p></div><div className="flex gap-3"><button aria-label="Restart chat" className="text-lg" onClick={() => void call({ action: "restart" })}>↻</button>{floating && <button aria-label="Minimize chat" className="text-xl" onClick={() => setOpen(false)}>×</button>}</div></header>
      <div aria-live="polite" className="max-h-[55vh] min-h-64 space-y-3 overflow-y-auto p-4">{view?.messages.map((message, index) => <p className={`w-fit max-w-[90%] rounded-2xl px-3 py-2 text-sm ${message.sender === "visitor" ? "ml-auto bg-blue-50 text-slate-800" : "bg-slate-100 text-slate-800"}`} key={`${index}-${message.content}`}>{message.content}</p>)}{error && <p className="text-sm text-red-700">{error}</p>}</div>
      {view?.options.length ? <div className="flex flex-wrap gap-2 border-t p-3">{view.options.map((option) => <button className="rounded-full border px-3 py-1.5 text-sm font-medium transition hover:bg-slate-50" key={option.id} onClick={() => void call({ action: "select", edgeId: option.id })}>{option.label}</button>)}</div> : null}
      {(view?.node.type === "capture" || view?.status === "active") ? <form className="flex gap-2 border-t p-3" onSubmit={(event) => { event.preventDefault(); if (text.trim()) { void call({ action: "text", text }); setText(""); } }}><input aria-label="Chat message" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" onChange={(event) => setText(event.target.value)} placeholder={view?.node.type === "capture" ? "Type your answer" : "Or ask us a question..."} value={text} /><button aria-label="Send message" className="rounded-lg px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: primary }}>Send</button></form> : null}
    </section>}
  </div>;
}
