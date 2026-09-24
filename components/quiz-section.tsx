'use client';

import { useMemo, useState } from 'react';
import { Markdown } from '@/components/markdown';
import { Badge, Skeleton } from '@/components/ui';
import type { Quiz } from '@/lib/types';

const LETTERS = ['A', 'B', 'C', 'D'];

export function QuizSection({ quiz, busy }: { quiz: Quiz | null; busy: boolean }) {
  const [selected, setSelected] = useState<Record<number, number>>({});

  const score = useMemo(() => {
    if (!quiz) return null;
    let correct = 0;
    for (const [idxStr, optIdx] of Object.entries(selected)) {
      const q = quiz.questions[Number(idxStr)];
      if (q && q.options[optIdx] === q.correctAnswer) correct += 1;
    }
    return correct;
  }, [selected, quiz]);

  if (busy) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!quiz || quiz.questions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
        No quiz yet. Hit <strong>“Generate quiz”</strong> above to test yourself.
      </p>
    );
  }

  const answeredCount = Object.keys(selected).length;
  const allAnswered = answeredCount === quiz.questions.length;

  return (
    <div className="space-y-4">
      {allAnswered && score !== null && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ring-1 ring-inset ${
            score === quiz.questions.length
              ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
              : score >= Math.ceil(quiz.questions.length / 2)
                ? 'bg-amber-50 text-amber-800 ring-amber-200'
                : 'bg-rose-50 text-rose-800 ring-rose-200'
          }`}
        >
          You scored {score} / {quiz.questions.length}
          {score === quiz.questions.length ? ' — perfect! 🎉' : ' — keep going!'}
        </div>
      )}
      {answeredCount > 0 && answeredCount < quiz.questions.length && (
        <p className="text-xs text-slate-400">
          {answeredCount} of {quiz.questions.length} answered
        </p>
      )}

      {quiz.questions.map((q, qi) => {
        const chosen = selected[qi];
        const revealed = chosen !== undefined;
        const correctIdx = q.options.findIndex((o) => o === q.correctAnswer);
        return (
          <div key={qi} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-2">
              <Badge tone="indigo">Q{qi + 1}</Badge>
              <div className="min-w-0 flex-1">
                <Markdown content={q.question.replace(/^\d+[.)]\s*/, '')} />
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              {q.options.map((opt, oi) => {
                const isChosen = chosen === oi;
                const isCorrect = correctIdx === oi;
                let cls = 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 text-slate-700';
                if (revealed) {
                  if (isCorrect) cls = 'border-emerald-500 bg-emerald-50 text-emerald-900';
                  else if (isChosen) cls = 'border-rose-400 bg-rose-50 text-rose-800';
                  else cls = 'border-slate-200 bg-white text-slate-400';
                }
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={revealed}
                    onClick={() => setSelected((prev) => ({ ...prev, [qi]: oi }))}
                    className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition disabled:cursor-default ${cls}`}
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600">
                      {LETTERS[oi]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Markdown content={opt.replace(/^[A-D]:\s*/, '')} />
                    </span>
                    {revealed && isCorrect && <span className="shrink-0 text-emerald-600">✓</span>}
                    {revealed && isChosen && !isCorrect && <span className="shrink-0 text-rose-500">✗</span>}
                  </button>
                );
              })}
            </div>

            {revealed && (
              <div className="animate-fade-in-up mt-3 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3.5 py-2.5 text-sm text-slate-700">
                <p className="font-semibold text-indigo-900">💡 Why: </p>
                <Markdown content={q.explanation} />
              </div>
            )}
          </div>
        );
      })}

      {answeredCount > 0 && (
        <button
          type="button"
          onClick={() => setSelected({})}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
        >
          Reset answers
        </button>
      )}
    </div>
  );
}