'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, ClientApiError } from '@/lib/api-client';
import { Sidebar } from '@/components/sidebar';
import { ErrorBanner, Spinner } from '@/components/ui';
import type { ConversationSummary, PublicUser } from '@/lib/types';

export const AppShellContext = createContext<{
  conversations: ConversationSummary[];
  user: PublicUser | null;
  refreshConversations: () => Promise<void>;
}>({
  conversations: [],
  user: null,
  refreshConversations: async () => {},
});

export function useAppShell() {
  return useContext(AppShellContext);
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, list] = await Promise.all([api.getMe(), api.listConversations()]);
      setUser(me);
      setConversations(list);
      setBootError(null);
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      setBootError(err instanceof Error ? err.message : 'Failed to load your account.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await api.listConversations());
    } catch {
      /* sidebar refresh is best-effort */
    }
  }, []);

  async function handleCreated(conversation: ConversationSummary) {
    await refreshConversations();
    router.push(`/app/${conversation.id}`);
  }

  async function handleLogout() {
    setUser(null);
    setConversations([]);
  }

  if (loading) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Spinner className="size-7" />
          <p className="text-sm">Loading your study desk…</p>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3">
          <ErrorBanner title="Could not load the app" message={bootError} retryLabel="Retry" onRetry={() => { setLoading(true); void load(); }} />
        </div>
      </div>
    );
  }

  return (
    <AppShellContext.Provider value={{ conversations, user, refreshConversations }}>
      <div className="flex h-dvh overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white md:block">
          <Sidebar user={user} conversations={conversations} activeId={undefined} loading={false} onCreated={handleCreated} onLogout={handleLogout} />
        </aside>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="fixed inset-0 z-40 bg-slate-900/40 md:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
        )}
        <aside
          className={`no-print fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transition-transform duration-200 md:hidden ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar
            user={user}
            conversations={conversations}
            activeId={undefined}
            loading={false}
            onCreated={handleCreated}
            onLogout={handleLogout}
            onClose={() => setMenuOpen(false)}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="no-print flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-semibold text-slate-900">🎓 AI Study Assistant</span>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto thin-scroll">{children}</main>
        </div>
      </div>
    </AppShellContext.Provider>
  );
}