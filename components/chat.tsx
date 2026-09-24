'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type FormEvent } from 'react';
import { Markdown } from '@/components/markdown';
import { Spinner } from '@/components/ui';
import type { Message } from '@/lib/types';

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm md:max-w-[75%] ${
          isUser
            ? 'rounded-br-md bg-indigo-600 text-white'
            : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <Markdown content={message.content} />
        )}
      </div>
    </div>
  );
}

export function Chat({
  messages,
  busy,
  onSend,
  footer,
}: {
  messages: Message[];
  busy: boolean;
  onSend: (content: string) => void;
  footer?: React.ReactNode;
}) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    setDraft('');
    onSend(content);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col print-area">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 thin-scroll md:px-6">
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
              <Spinner className="size-4 text-indigo-500" />
              <span className="typing-dots">Thinking…</span>
            </div>
          </div>
        )}
      </div>

      {footer}

      <form onSubmit={submit} className="no-print border-t border-slate-200 bg-white p-3 md:p-4">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask a follow-up question…  (Enter to send, Shift+Enter for a new line)"
            className="max-h-40 min-h-[44px] flex-1 resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Send message"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Spinner className="size-5" />
            ) : (
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}