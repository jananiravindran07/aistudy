'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { NewConversationForm } from '@/components/new-conversation-form';
import { Badge, difficultyTone, Spinner } from '@/components/ui';
import type { ConversationSummary, PublicUser } from '@/lib/types';

export function Sidebar({
  user,
  conversations,
  activeId,
  loading,
  onCreated,
  onLogout,
  onClose,
}: {
  user: PublicUser | null;
  conversations: ConversationSummary[];
  activeId?: string;
  loading: boolean;
  onCreated: (c: ConversationSummary) => void;
  onLogout: () => void;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      onLogout();
      router.replace('/login');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">🎓</div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-900">AI Study</p>
            <p className="text-xs text-slate-500">Assistant</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      <div className="px-4 pt-4">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          {showForm ? 'Close' : '+ New conversation'}
        </button>

        {showForm && (
          <div className="animate-fade-in-up mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <NewConversationForm
              compact
              onCreated={(c) => {
                setShowForm(false);
                onCreated(c);
              }}
            />
          </div>
        )}
      </div>

      <nav className="mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-2 thin-scroll" aria-label="Conversations">
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner className="size-5 text-slate-400" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-400">
            No conversations yet. Start one above 👆
          </p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((c) => {
              const active = c.id === activeId;
              return (
                <li key={c.id}>
                  <Link
                    href={`/app/${c.id}`}
                    onClick={onClose}
                    className={`group block rounded-lg px-3 py-2.5 text-sm transition ${
                      active ? 'bg-indigo-50 text-indigo-900 ring-1 ring-inset ring-indigo-100' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    title={c.topic}
                  >
                    <span className="block truncate font-medium">{c.title}</span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <Badge tone={difficultyTone(c.difficulty)}>{c.difficulty}</Badge>
                      {c.sourceText && <span className="text-[10px] text-slate-400">📄 doc</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">{user?.name ?? '…'}</p>
            <p className="truncate text-xs text-slate-500" title={user?.email}>
              {user?.email ?? ''}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}