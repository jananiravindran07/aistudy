import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-50 to-sky-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-indigo-100/60">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-lg text-white shadow-sm">
              🎓
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-slate-900">AI Study Assistant</h1>
              <p className="text-xs text-slate-500">Explain · Notes · Quizzes · Study plans</p>
            </div>
          </div>
          {children}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Powered by your own API key — stored server-side, never in the browser.
        </p>
      </div>
    </main>
  );
}