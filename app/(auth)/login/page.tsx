import { AuthForm } from '@/components/auth-form';

export default function LoginPage() {
  return (
    <>
      <h2 className="mt-6 text-xl font-bold text-slate-900">Welcome back</h2>
      <p className="mt-1 text-sm text-slate-500">Sign in to pick up where you left off.</p>
      <AuthForm mode="login" />
    </>
  );
}