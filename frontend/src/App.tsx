import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { BookMarked, Carrot, LogOut } from 'lucide-react';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CapybaraDemo from './pages/CapybaraDemo';
import Library from './pages/Library';
import { AuthProvider, useAuth } from './context/AuthContext';

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="app-header sticky top-0 z-50 border-b border-white/70 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to={user ? '/dashboard' : '/login'} className="brand-mark flex items-center gap-2 text-xl font-extrabold text-pastel-brown sm:text-2xl">
          <span className="brand-icon" aria-hidden="true">c</span> CapybaraStudy
        </Link>
        {user && (
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden min-w-28 flex-col items-end sm:flex">
              <span className="text-xs font-bold text-pastel-brown">Level {user.level}</span>
              <div className="h-2 w-24 overflow-hidden rounded-full border border-pastel-tan/60 bg-pastel-cream">
                <div className="h-full rounded-full bg-pastel-pink transition-all duration-500" style={{ width: `${user.happiness}%` }} />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-pastel-peach bg-pastel-peach/30 px-2 py-1 text-pastel-brown sm:px-3">
              <span className="inline-flex items-center gap-1 font-bold" aria-label={`${user.carrots} carrots`}>
                <Carrot size={18} aria-hidden="true" /> {user.carrots}
              </span>
            </div>
            <Link to="/library" className="icon-button" aria-label="My library" title="My library">
              <BookMarked size={18} aria-hidden="true" />
            </Link>
            <button type="button" onClick={handleLogout} className="icon-button" aria-label="Log out" title="Log out">
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function ProtectedDashboard() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="page-loading" role="status">Warming up your study nook...</div>;
  return user ? <Dashboard /> : <Navigate to="/login" replace />;
}

function ProtectedLibrary() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="page-loading" role="status">Warming up your study nook...</div>;
  return user ? <Library /> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-shell flex min-h-screen flex-col">
          <Header />
          <main className="mx-auto w-full max-w-7xl flex-grow px-4 py-5 sm:px-6 sm:py-8">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<ProtectedDashboard />} />
              <Route path="/library" element={<ProtectedLibrary />} />
              <Route path="/capybara-demo" element={<CapybaraDemo />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
