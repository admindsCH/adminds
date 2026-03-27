"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUp, Sparkles, User, Search } from "lucide-react";
import { useTextareaResize } from "@/hooks/use-textarea-resize";
import { api } from "@/lib/api";
import type { PatientDossier } from "@/lib/schemas/classification";

// ── Types ────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface DossierChatProps {
  dossier: PatientDossier;
}

// ── Suggested questions ──────────────────────────────────

const SUGGESTIONS = [
  "Quels sont les diagnostics ?",
  "Traitement en cours ?",
  "Capacité de travail ?",
  "Antécédents ?",
];

// ── Chat component (inline card) ─────────────────────────

export function DossierChat({ dossier }: DossierChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useTextareaResize(input, 1);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: trimmed }]);
    setInput("");
    setIsTyping(true);

    try {
      const { answer } = await api.dossierChat(trimmed, dossier.raw_content ?? "");
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: answer }]);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Erreur inattendue";
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: `Erreur: ${errorMsg}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  };

  const hasMessages = messages.length > 0 || isTyping;

  return (
    <div className="rounded-lg border border-zinc-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-violet-50 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
          <Search className="h-4 w-4 text-indigo-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">Rechercher dans le dossier</p>
          <p className="hidden text-[11px] text-zinc-500 sm:block">Posez une question pour trouver une information dans les données patient</p>
        </div>
        {hasMessages && (
          <button
            onClick={() => setMessages([])}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-zinc-400 hover:bg-white/60 hover:text-zinc-600 transition-colors"
          >
            Effacer
          </button>
        )}
      </div>

      {/* Suggestions (when no messages) */}
      {!hasMessages && (
        <div className="flex flex-wrap gap-1.5 border-b border-zinc-100 bg-zinc-50/30 px-3 py-2 sm:gap-2 sm:px-4 sm:py-2.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors shadow-sm sm:px-3"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Messages area */}
      {hasMessages && (
        <div className="max-h-[320px] overflow-y-auto px-4 py-3">
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      msg.role === "assistant" ? "bg-indigo-50" : "bg-zinc-100"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <Sparkles className="h-3 w-3 text-indigo-500" />
                    ) : (
                      <User className="h-3 w-3 text-zinc-500" />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-50 border border-zinc-100 text-zinc-800"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <FormattedContent content={msg.content} />
                    ) : (
                      msg.content
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2.5"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                  <Sparkles className="h-3 w-3 text-indigo-500" />
                </div>
                <div className="rounded-2xl bg-zinc-50 border border-zinc-100 px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-zinc-100 px-3 py-2.5 bg-white">
        <div className="flex items-end gap-2 rounded-xl border border-zinc-200 bg-zinc-50/50 p-1.5 focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-200 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Quand a commencé l'arrêt de travail ?"
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none max-h-[100px] min-h-0 overflow-y-auto"
          />
          <button
            onClick={() => submit(input)}
            disabled={!input.trim() || isTyping}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Simple markdown-like formatting ──────────────────────

function FormattedContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i}>
            {parts.map((part, j) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
              }
              return <span key={j}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}
