'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

/* ---------------------------------- Button ---------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600 shadow-sm',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:outline-slate-300',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 focus-visible:outline-rose-600 shadow-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
  size?: 'sm' | 'md';
}

export function Button({
  variant = 'primary',
  loading = false,
  loadingLabel,
  size = 'md',
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm'
      } ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

/* ---------------------------------- Spinner --------------------------------- */

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/* --------------------------------- Skeleton --------------------------------- */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} aria-hidden="true" />;
}

/* --------------------------------- Badge ------------------------------------ */

export function Badge({
  children,
  tone = 'slate',
  className = '',
}: {
  children: ReactNode;
  tone?: 'slate' | 'indigo' | 'amber' | 'emerald' | 'rose';
  className?: string;
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function difficultyTone(difficulty: string): 'emerald' | 'amber' | 'rose' {
  if (difficulty === 'Beginner') return 'emerald';
  if (difficulty === 'Advanced') return 'rose';
  return 'amber';
}

/* ---------------------------------- Card ------------------------------------ */

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/* ------------------------------- Error banner ------------------------------- */

export function ErrorBanner({
  title = 'Something went wrong',
  message,
  retryLabel = 'Try again',
  onRetry,
  onDismiss,
}: {
  title?: string;
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="alert"
      className="no-print flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800"
    >
      <div className="mt-0.5 shrink-0 text-rose-500" aria-hidden="true">
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {message && <p className="mt-0.5 text-sm text-rose-700">{message}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
          >
            {retryLabel}
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-100"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}