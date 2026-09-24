'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chat } from '@/components/chat';
import { Markdown } from '@/components/markdown';
import { PlanSection } from '@/components/plan-section';
import { QuizSection } from '@/components/quiz-section';
import { Badge, Button, Card, difficultyTone, ErrorBanner, Skeleton } from '@/components/ui';
import { api, ClientApiError } from '@/lib/api-client';
import type { ConversationDetail, Mode } from '@/lib/types';

const GENERATE_MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: 'explain', label: 'Explain', hint: 'Get a clear explanation of this topic in the chat' },
  { mode: 'notes', label: 'Notes', hint: 'Generate structured study notes' },
  { mode: 'quiz', label: 'Quiz', hint: 'Generate a quiz to test yourself' },
  { mode: 'plan', label: 'Plan', hint: 'Generate a day-by-day study plan' },
];

type PendingAction = { kind: 'chat'; content: string } | { kind: 'generate'; mode: Mode };

function ConversationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [generating, setGenerating] = useState<Mode | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingRef = useRef<PendingAction | null>(null);

  /* ------------------------------ load detail ------------------------------ */

  const activeIdRef = useRef<string | null>(null);

  const load = useCallback(
    async (targetId: string) => {
      setLoadError(null);
      setLoading(true);
      try {
        const d = await api.getConversation(targetId);
        if (activeIdRef.current !== targetId) return; // stale response from a previous conversation
        setDetail(d);
      } catch (err) {
        if (activeIdRef.current !== targetId) return;
        if (err instanceof ClientApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setLoadError(err instanceof Error ? err.message : 'Failed to load this conversation.');
      } finally {
        if (activeIdRef.current === targetId) setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    activeIdRef.current = id;
    setLoadError(null);
    setActionError(null);
    setDetail(null);
    setChatBusy(false);
    setGenerating(null);
    pendingRef.current = null;
    void load(id);
  }, [id, load]);

  /* ------------------------------- actions --------------------------------- */

  const flashNotice = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      setChatBusy(true);
      setActionError(null);
      const pending: PendingAction = { kind: 'chat', content };
      pendingRef.current = pending;
      try {
        const res = await api.sendMessage(id, content);
        setDetail((d) =>
          d ? { ...d, messages: [...d.messages, res.userMessage, res.assistantMessage] } : d,
        );
        pendingRef.current = null;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Failed to send your message.');
      } finally {
        setChatBusy(false);
      }
    },
    [id],
  );

  const handleGenerate = useCallback(
    async (mode: Mode) => {
      setGenerating(mode);
      setActionError(null);
      pendingRef.current = { kind: 'generate', mode };
      try {
        const res = await api.generate({ conversationId: id, mode });
        setDetail((d) => {
          if (!d) return d;
          return {
            ...d,
            messages: res.message ? [...d.messages, res.message] : d.messages,
            note: res.note ?? d.note,
            quiz: res.quiz ?? d.quiz,
            plan: res.plan ?? d.plan,
          };
        });
        if (res.mocked) flashNotice('Sample output (mock mode is on — add an OPENAI_API_KEY for real results).');
        pendingRef.current = null;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
      } finally {
        setGenerating(null);
      }
    },
    [id, flashNotice],
  );

  const retryPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    if (pending.kind === 'chat') void handleSend(pending.content);
    else void handleGenerate(pending.mode);
  }, [handleSend, handleGenerate]);

  /* -------------------------------- loading -------------------------------- */

  if (loadError) {
    return (
      <div className="p-6 md:p-10">
        <ErrorBanner
          title="Could not load this conversation"
          message={loadError}
          retryLabel="Retry"
          onRetry={() => void load(id)}
          onDismiss={() => router.push('/app')}
        />
      </div>
    );
  }

  if (loading || !detail) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-16 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-[380px] w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    );
  }

  const busy = chatBusy || generating !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ------------------------------ header ------------------------------ */}
      <header className="no-print flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-4 md:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-slate-900">{detail.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone={difficultyTone(detail.difficulty)}>{detail.difficulty}</Badge>
            {detail.sourceText && <Badge tone="slate">📄 uploaded document</Badge>}
            <span className="text-xs text-slate-400">
              {detail.messages.length} message{detail.messages.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.print()} disabled={busy}>
            🖨️ Print
          </Button>
          <div className="flex items-center gap-1.5">
            {detail.note && (
              <a
                href={api.exportUrl(id, 'notes')}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Notes .md
              </a>
            )}
            {detail.quiz && (
              <a
                href={api.exportUrl(id, 'quiz')}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Quiz .md
              </a>
            )}
            {detail.plan && (
              <a
                href={api.exportUrl(id, 'plan')}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Plan .md
              </a>
            )}
          </div>
        </div>
      </header>

      {/* --------------------------- generate toolbar ------------------------- */}
      <div className="no-print flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3 md:px-6">
        <span className="mr-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Generate</span>
        {GENERATE_MODES.map(({ mode, label, hint }) => (
          <Button
            key={mode}
            size="sm"
            variant={mode === 'explain' ? 'secondary' : 'primary'}
            title={hint}
            disabled={busy || loading}
            loading={generating === mode}
            onClick={() => void handleGenerate(mode)}
          >
            {generating === mode ? `${label}ing…` : label}
          </Button>
        ))}
        {notice && <span className="ml-auto text-xs text-amber-600">{notice}</span>}
      </div>

      {/* ------------------------------ chat area ----------------------------- */}
      <section className="flex h-[55vh] min-h-[380px] flex-col border-b border-slate-200">
        <Chat messages={detail.messages} busy={chatBusy} onSend={(c) => void handleSend(c)} />
      </section>

      {/* ------------------------------ sections ------------------------------ */}
      <div className="print-break-before space-y-6 px-4 py-6 md:px-6 print-area">
        {actionError && (
          <ErrorBanner
            title="That didn't work"
            message={actionError}
            onRetry={retryPending}
            onDismiss={() => setActionError(null)}
          />
        )}

        {/* Notes */}
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold text-slate-900">📝 Notes</h2>
            {detail.note && (
              <a
                href={api.exportUrl(id, 'notes')}
                target="_blank"
                rel="noreferrer"
                className="no-print rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
              >
                Download .md ↓
              </a>
            )}
          </div>
          <div className="px-4 py-4">
            {generating === 'notes' ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : detail.note ? (
              <Markdown content={detail.note.content} />
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                No notes yet. Hit <strong>“Notes”</strong> in the toolbar to generate an outline.
              </p>
            )}
          </div>
        </Card>

        {/* Quiz */}
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold text-slate-900">🎯 Quiz</h2>
            {detail.quiz && (
              <a
                href={api.exportUrl(id, 'quiz')}
                target="_blank"
                rel="noreferrer"
                className="no-print rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
              >
                Download .md ↓
              </a>
            )}
          </div>
          <div className="px-4 py-4">
            <QuizSection quiz={detail.quiz} busy={generating === 'quiz'} />
          </div>
        </Card>

        {/* Study plan */}
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold text-slate-900">🗓️ Study plan</h2>
            {detail.plan && (
              <a
                href={api.exportUrl(id, 'plan')}
                target="_blank"
                rel="noreferrer"
                className="no-print rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
              >
                Download .md ↓
              </a>
            )}
          </div>
          <div className="px-4 py-4">
            <PlanSection plan={detail.plan} busy={generating === 'plan'} />
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * The real component lives above; this wrapper provides a Suspense boundary so
 * `useParams` (which suspends on dynamic routes without generateStaticParams)
 * can resolve during prerendering/hydration.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ConversationPage />
    </Suspense>
  );
}