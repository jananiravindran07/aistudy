import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Capybara, { type CapybaraState } from '../components/Capybara';
import Timer from '../components/Timer';
import TodoList from '../components/TodoList';
import StudyPanel from '../components/StudyPanel';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, feedCapybara } = useAuth();
  const [capyState, setCapyState] = useState<CapybaraState>('idle');
  const [showFeedAnim, setShowFeedAnim] = useState(false);
  const [levelUp, setLevelUp] = useState(false);
  const previousLevel = useRef(user?.level ?? 1);

  useEffect(() => {
    const currentLevel = user?.level ?? 1;
    if (currentLevel > previousLevel.current) {
      setLevelUp(true);
      const timeout = window.setTimeout(() => setLevelUp(false), 1500);
      previousLevel.current = currentLevel;
      return () => window.clearTimeout(timeout);
    }
    previousLevel.current = currentLevel;
  }, [user?.level]);

  // Auto-revert back to idle after positive states
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (capyState === 'happy' || capyState === 'eating' || capyState === 'studying') {
      timeout = setTimeout(() => {
        setCapyState('idle');
      }, 3500);
    }
    return () => clearTimeout(timeout);
  }, [capyState]);

  // Simulate sleepy when idle for 10s
  useEffect(() => {
    if (capyState !== 'idle') return;
    const timeout = setTimeout(() => {
      setCapyState('sleepy');
    }, 10000);
    return () => clearTimeout(timeout);
  }, [capyState]);

  const handleFeed = async () => {
    if (!user || user.carrots < 1) return;
    try {
      await feedCapybara();
      setCapyState('eating');
      setShowFeedAnim(true);
      window.setTimeout(() => setShowFeedAnim(false), 1500);
    } catch {
      setCapyState('idle');
    }
  };

  const capyTitles = [
    'Sleepy Pup',
    'Happy Capy',
    'Study Buddy',
    'Scholar Capy',
    'Master Capybara',
  ];

  const currentTitle = user
    ? capyTitles[Math.min((user.level || 1) - 1, capyTitles.length - 1)]
    : 'Capybara';

  const happinessColor =
    (user?.happiness ?? 0) >= 70 ? '#7fc97f' :
    (user?.happiness ?? 0) >= 40 ? '#ffd06e' : '#f4a261';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-7rem)]">
      {/* Sidebar */}
      <div className="card lg:col-span-1 overflow-y-auto flex flex-col items-center py-4 px-4">
        {/* Capybara Avatar */}
        <div className="relative w-40 h-40 mb-2">
          <Capybara mood={capyState} levelUp={levelUp} />
          <AnimatePresence>
            {showFeedAnim && (
              <motion.div
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -40, scale: 1.5 }}
                exit={{ opacity: 0 }}
                className="absolute top-0 right-0 text-2xl pointer-events-none"
              >
                🥕
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <h2 className="text-lg font-bold text-pastel-brown">{currentTitle}</h2>
        <p className="text-xs text-pastel-brown/60 mb-1">Level {user?.level ?? 1}</p>

        {/* Happiness bar */}
        <div className="w-full mb-3 px-2">
          <div className="flex justify-between text-xs text-pastel-brown/50 mb-1">
            <span>Happiness</span>
            <span>{user?.happiness ?? 0}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-pastel-cream overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: happinessColor }}
              animate={{ width: `${user?.happiness ?? 0}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Carrot + Feed button */}
        <div className="flex items-center gap-3 mb-4 w-full">
          <div className="flex items-center gap-1 bg-white/60 rounded-2xl px-3 py-1.5 border-2 border-pastel-peach/40">
            <span className="text-lg">🥕</span>
            <span className="font-bold text-pastel-brown">{user?.carrots ?? 0}</span>
            <span className="text-xs text-pastel-brown/50">carrots</span>
          </div>
          <button
            onClick={handleFeed}
            disabled={!user || user.carrots < 1}
            className="btn-primary text-sm flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Feed 🥕
          </button>
        </div>

        {/* Study / Celebrate buttons */}
        <div className="flex gap-2 mb-6 w-full">
          <button onClick={() => setCapyState('studying')} className="btn-secondary text-xs flex-1">📖 Study</button>
          <button onClick={() => setCapyState('happy')} className="btn-secondary text-xs flex-1">🎉 Party</button>
        </div>

        {/* Timer + Todo */}
        <div className="w-full space-y-5">
          <Timer onMoodChange={setCapyState} />
          <TodoList />
        </div>
      </div>

      {/* Main AI Study Panel */}
      <div className="card lg:col-span-2 flex flex-col overflow-hidden">
        <StudyPanel onCapybaraStateChange={setCapyState} />
      </div>
    </div>
  );
}
