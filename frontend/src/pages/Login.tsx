import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-panel card mx-auto mt-6 max-w-md text-center sm:mt-12">
      <span className="auth-kicker">Your cozy study corner</span>
      <h1 className="mb-2 text-3xl text-pastel-brown">Welcome back</h1>
      <p className="mb-6 text-sm text-pastel-brown/70">Pick up right where you left off.</p>
      <form className="flex flex-col gap-4 text-left" onSubmit={handleSubmit}>
        <label className="form-label">
          Email
        <input 
          type="email" 
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="form-input"
        />
        </label>
        <label className="form-label">
          Password
        <input 
          type="password" 
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="form-input"
        />
        </label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="btn-primary mt-2 w-full disabled:cursor-wait disabled:opacity-60">
          {isSubmitting ? 'Opening your study nook...' : 'Log in'}
        </button>
        <p className="mt-2 text-center text-sm text-pastel-brown/70">
          New to CapybaraStudy? <Link to="/register" className="font-bold text-pastel-brown hover:underline">Create an account</Link>
        </p>
      </form>
    </section>
  );
}
