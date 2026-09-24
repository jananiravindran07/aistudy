'use client';

import { useRef, useState, type FormEvent } from 'react';
import { api, ClientApiError } from '@/lib/api-client';
import { DIFFICULTIES } from '@/lib/validation';
import { Button, Spinner } from '@/components/ui';
import type { ConversationSummary } from '@/lib/types';

export function NewConversationForm({
  onCreated,
  compact = false,
}: {
  onCreated: (conversation: ConversationSummary) => void;
  compact?: boolean;
}) {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<string>('Beginner');
  const [file, setFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasFile = file !== null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (hasFile) {
      // --- File-based conversation (bonus: .txt / .pdf) ---
      if (file.size > 5 * 1024 * 1024) {
        setError('That file is larger than 5 MB. Please upload a smaller file.');
        return;
      }
      const fd = new FormData();
      fd.append('file', file);
      if (fileTitle.trim()) fd.append('title', fileTitle.trim());
      fd.append('difficulty', difficulty);
      setBusy(true);
      try {
        const conversation = await api.uploadFile(fd);
        onCreated(conversation);
        resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      } finally {
        setBusy(false);
      }
      return;
    }

    // --- Topic-based conversation ---
    if (!topic.trim()) {
      setError('Please enter a topic you want to study.');
      return;
    }
    setBusy(true);
    try {
      const conversation = await api.createConversation({ topic: topic.trim(), difficulty });
      onCreated(conversation);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      if (err instanceof ClientApiError && err.status === 401) return;
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setTopic('');
    setFile(null);
    setFileTitle('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {hasFile ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-indigo-800" title={file.name}>
              📄 {file.name}
            </p>
            <p className="text-xs text-indigo-600">Study this document</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
          >
            Remove
          </button>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="new-topic" className="mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase">
              What do you want to study?
            </label>
            <input
              id="new-topic"
              type="text"
              value={topic}
              maxLength={200}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Quantum computing, Photosynthesis, Calculus…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label htmlFor="new-file-upload" className="mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Or upload a document (.txt / .pdf)
            </label>
            <input
              id="new-file-upload"
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf,text/plain,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                setError(null);
              }}
              className="block w-full text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>
          {hasFile && (
            <input
              type="text"
              value={fileTitle}
              onChange={(e) => setFileTitle(e.target.value)}
              placeholder="Optional: name for this document"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          )}
        </>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase">Difficulty</label>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => {
            const active = difficulty === d;
            const tone =
              d === 'Beginner' ? 'data-[active=true]:bg-emerald-600 data-[active=true]:border-emerald-600'
              : d === 'Intermediate' ? 'data-[active=true]:bg-amber-500 data-[active=true]:border-amber-500'
              : 'data-[active=true]:bg-rose-600 data-[active=true]:border-rose-600';
            return (
              <button
                key={d}
                type="button"
                data-active={active}
                onClick={() => setDifficulty(d)}
                className={`rounded-lg border px-2 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 data-[active=true]:border-transparent data-[active=true]:text-white ${tone}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          {error}
        </p>
      )}

      <Button
        type="submit"
        loading={busy}
        loadingLabel={hasFile ? 'Uploading…' : 'Creating…'}
        className={compact ? 'w-full' : 'w-full py-3 text-base'}
      >
        {busy ? <Spinner className="size-4" /> : hasFile ? 'Study this document' : 'Start studying'}
      </Button>
    </form>
  );
}