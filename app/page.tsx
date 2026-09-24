import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/auth';

export default async function Home() {
  const store = await cookies();
  const hasSession = store.has(SESSION_COOKIE);
  redirect(hasSession ? '/app' : '/login');
}