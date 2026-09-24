'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NewConversationForm } from '@/components/new-conversation-form';
import { useAppShell } from '@/components/app-shell';
import { Skeleton } from '@/components/ui';

export default function AppHome() {
  const router = useRouter();
  const { conversations } = useAppShell();

  useEffect(() => {
    if (conversations.length > 0) {
      router.replace(`/app/${conversations[0].id}`);
    }
  }, [conversations, router]);

  if (conversations.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 md:py-16">
        <h1 className="text-2xl font-bold text-slate-900">Welcome to your study desk 👋</h1>
        <p className="mt-2 text-sm text-slate-500">
          Pick a topic (or upload a <strong>.txt</strong> / <strong>.pdf</strong> document), choose a difficulty, and I&apos;ll
          generate explanations, notes, quizzes and a study plan — all saved for you.
        </p>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <NewConversationForm
            onCreated={(c) => router.push(`/app/${c.id}`)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 md:p-6">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}