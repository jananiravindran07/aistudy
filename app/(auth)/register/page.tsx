import { AuthForm } from '@/components/auth-form';

export default function RegisterPage() {
  return (
    <>
      <h2 className="mt-6 text-xl font-bold text-slate-900">Create your account</h2>
      <p className="mt-1 text-sm text-slate-500">
        Start a conversation on any topic and get notes, quizzes and a study plan.
      </p>
      <AuthForm mode="register" />
    </>
  );
}