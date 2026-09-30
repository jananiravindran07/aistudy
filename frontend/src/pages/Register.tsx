import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create your account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-panel card mx-auto mt-6 max-w-md text-center sm:mt-12">
      <span className="auth-kicker">A little more focus, a lot more carrots</span>
      <h1 className="mb-2 text-3xl text-pastel-brown">Make your study nook</h1>
      <p className="mb-6 text-sm text-pastel-brown/70">Your capybara is saving you a sunny spot.</p>
      <form className="flex flex-col gap-4 text-left" onSubmit={handleSubmit}>
        <label className="form-label">
          Name <span className="font-normal text-pastel-brown/55">(optional)</span>
        <input 
          type="text" 
          autoComplete="name"
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="form-input"
        />
        </label>
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
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="form-input"
        />
        </label>
        <p className="text-xs leading-relaxed text-pastel-brown/60">Use at least 8 characters for your password.</p>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="btn-primary mt-1 w-full disabled:cursor-wait disabled:opacity-60">
          {isSubmitting ? 'Making your nook...' : 'Create account'}
        </button>
        <p className="mt-2 text-center text-sm text-pastel-brown/70">
          Already have an account? <Link to="/login" className="font-bold text-pastel-brown hover:underline">Log in</Link>
        </p>
      </form>
    </section>
  );
}
