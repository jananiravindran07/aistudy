import { useState, useEffect, useRef, useEffectEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { Play, Pause, RotateCcw, Coffee, Brain } from 'lucide-react';
import type { CapybaraMood } from './Capybara';

type TimerMode = 'work' | 'break';

interface TimerSnapshot {
  timeLeft: number;
  isActive: boolean;
  mode: TimerMode;
  workMinutes: number;
  breakMinutes: number;
  goal: string;
}

const readTimerSnapshot = (): TimerSnapshot => {
  const workMinutes = Number(localStorage.getItem('capybara_timer_work')) || 25;
  const breakMinutes = Number(localStorage.getItem('capybara_timer_break')) || 5;
  const mode = localStorage.getItem('capybara_timer_mode') === 'break' ? 'break' : 'work';
  const endTime = Number(localStorage.getItem('capybara_timer_end'));
  const savedRemaining = Number(localStorage.getItem('capybara_timer_remaining'));
  const activeRemaining = endTime ? Math.ceil((endTime - Date.now()) / 1000) : 0;

  return {
    timeLeft: activeRemaining > 0 ? activeRemaining : savedRemaining || (mode === 'work' ? workMinutes : breakMinutes) * 60,
    isActive: activeRemaining > 0,
    mode,
    workMinutes,
    breakMinutes,
    goal: localStorage.getItem('capybara_timer_goal') ?? '',
  };
};

export default function Timer({ onMoodChange }: { onMoodChange?: (mood: CapybaraMood) => void }) {
  const { completeSession } = useAuth();
  const [snapshot] = useState(readTimerSnapshot);
  const [timeLeft, setTimeLeft] = useState(snapshot.timeLeft);
  const [isActive, setIsActive] = useState(snapshot.isActive);
  const [mode, setMode] = useState<TimerMode>(snapshot.mode);
  const [workMinutes, setWorkMinutes] = useState(snapshot.workMinutes);
  const [breakMinutes, setBreakMinutes] = useState(snapshot.breakMinutes);
  const [customMinutes, setCustomMinutes] = useState(snapshot.workMinutes);
  const [sessionGoal, setSessionGoal] = useState(snapshot.goal);
  const [notice, setNotice] = useState('');
  const completionStarted = useRef(false);

  useEffect(() => {
    if (snapshot.isActive && mode === 'work') onMoodChange?.('studying');
  }, [snapshot.isActive, mode, onMoodChange]);

  const handleComplete = useEffectEvent(async () => {
    if (completionStarted.current) return;
    completionStarted.current = true;
    setIsActive(false);
    localStorage.removeItem('capybara_timer_end');
    onMoodChange?.(mode === 'work' ? 'happy' : 'idle');

    try {
      const audio = new window.AudioContext();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.12, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.65);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.65);
      void audio.close();
    } catch {
      setNotice('Your timer is complete.');
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Time is up!', {
        body: mode === 'work' ? 'Great focus! Your carrots are ready. Time for a break!' : 'Break is over. Back to studying!',
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') new Notification('Time is up!', { body: 'Great focus. Your carrots are ready.' });
      });
    }

    if (mode === 'work') {
      try {
        const result = await completeSession(workMinutes, sessionGoal.trim() || undefined);
        setNotice(`Session complete: +${result.carrotsAwarded} carrots${result.streak > 1 ? ` · ${result.streak}-day streak` : ''}`);
      } catch {
        setNotice('Session complete, but your reward could not be saved.');
      }
      setMode('break');
      setTimeLeft(breakMinutes * 60);
    } else {
      setNotice('Break complete. Ready for another focus session?');
      setMode('work');
      setTimeLeft(workMinutes * 60);
    }
  });

  useEffect(() => {
    localStorage.setItem('capybara_timer_mode', mode);
    localStorage.setItem('capybara_timer_work', String(workMinutes));
    localStorage.setItem('capybara_timer_break', String(breakMinutes));
    localStorage.setItem('capybara_timer_goal', sessionGoal);

    if (!isActive) {
      localStorage.removeItem('capybara_timer_end');
      localStorage.setItem('capybara_timer_remaining', String(timeLeft));
      return;
    }

    const endTime = Number(localStorage.getItem('capybara_timer_end')) || Date.now() + timeLeft * 1000;
    localStorage.setItem('capybara_timer_end', String(endTime));
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(interval);
        void handleComplete();
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [isActive, mode, timeLeft, workMinutes, breakMinutes, sessionGoal]);

  const toggleTimer = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const nextActive = !isActive;
    completionStarted.current = false;
    setIsActive(nextActive);
    onMoodChange?.(nextActive && mode === 'work' ? 'studying' : 'idle');
  };

  const resetTimer = () => {
    setIsActive(false);
    onMoodChange?.('idle');
    localStorage.removeItem('capybara_timer_end');
    completionStarted.current = false;
    setNotice('');
    setTimeLeft((mode === 'work' ? workMinutes : breakMinutes) * 60);
  };

  const setPreset = (nextWorkMinutes: number, nextBreakMinutes: number) => {
    setIsActive(false);
    localStorage.removeItem('capybara_timer_end');
    localStorage.setItem('capybara_timer_remaining', String(nextWorkMinutes * 60));
    setMode('work');
    setWorkMinutes(nextWorkMinutes);
    setBreakMinutes(nextBreakMinutes);
    setCustomMinutes(nextWorkMinutes);
    setTimeLeft(nextWorkMinutes * 60);
    onMoodChange?.('idle');
  };

  const applyCustomDuration = () => {
    const duration = Math.min(180, Math.max(1, Math.floor(customMinutes)));
    setIsActive(false);
    localStorage.removeItem('capybara_timer_end');
    localStorage.setItem('capybara_timer_remaining', String(duration * 60));
    setWorkMinutes(duration);
    setMode('work');
    setTimeLeft(duration * 60);
    onMoodChange?.('idle');
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="card text-center mb-6 border-pastel-blue">
      <div className="flex justify-center gap-4 mb-4">
        <button 
          onClick={() => { setMode('work'); setTimeLeft(workMinutes * 60); setIsActive(false); onMoodChange?.('idle'); }}
          aria-pressed={mode === 'work'}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${mode === 'work' ? 'bg-pastel-blue text-white' : 'bg-pastel-cream text-pastel-brown/70'}`}
        >
          <Brain size={16} /> Focus
        </button>
        <button 
          onClick={() => { setMode('break'); setTimeLeft(breakMinutes * 60); setIsActive(false); onMoodChange?.('idle'); }}
          aria-pressed={mode === 'break'}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${mode === 'break' ? 'bg-pastel-mint text-white' : 'bg-pastel-cream text-pastel-brown/70'}`}
        >
          <Coffee size={16} /> Break
        </button>
      </div>

      <div className="text-6xl font-display font-bold text-pastel-brown mb-4 tabular-nums">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>

      <div className="flex justify-center gap-3 mb-6">
        <button onClick={toggleTimer} aria-label={isActive ? 'Pause timer' : 'Start timer'} className="bg-pastel-orange hover:bg-pastel-peach text-white p-3 rounded-full transition-transform active:scale-95 shadow-sm">
          {isActive ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
        </button>
        <button onClick={resetTimer} aria-label="Reset timer" className="bg-pastel-cream hover:bg-white text-pastel-brown p-3 rounded-full transition-transform active:scale-95 shadow-sm border-2 border-pastel-cream">
          <RotateCcw />
        </button>
      </div>

      <div className="flex justify-center gap-2 mb-4">
        <button onClick={() => setPreset(25, 5)} className="text-xs bg-pastel-cream hover:bg-pastel-blue hover:text-white px-2 py-1 rounded-lg text-pastel-brown/70 transition-colors">25/5</button>
        <button onClick={() => setPreset(50, 10)} className="text-xs bg-pastel-cream hover:bg-pastel-blue hover:text-white px-2 py-1 rounded-lg text-pastel-brown/70 transition-colors">50/10</button>
      </div>

      <div className="mb-3 flex items-center justify-center gap-2">
        <label htmlFor="custom-focus-minutes" className="text-xs font-bold text-pastel-brown/70">Custom focus</label>
        <input
          id="custom-focus-minutes"
          type="number"
          min={1}
          max={180}
          value={customMinutes}
          onChange={(event) => setCustomMinutes(Number(event.target.value))}
          className="w-16 rounded-lg border-2 border-pastel-blue/40 bg-white/70 px-2 py-1 text-center text-sm font-bold"
        />
        <span className="text-xs text-pastel-brown/60">min</span>
        <button type="button" onClick={applyCustomDuration} className="rounded-lg bg-pastel-blue/60 px-3 py-1 text-xs font-extrabold text-pastel-brown hover:bg-pastel-blue">Set</button>
      </div>

      <input 
        type="text" 
        placeholder="Session goal (optional)" 
        value={sessionGoal}
        onChange={(e) => setSessionGoal(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded-xl border-2 border-pastel-blue/30 focus:border-pastel-blue focus:outline-none bg-white/50 text-center"
      />
      {notice && <p role="status" className="mt-3 text-xs font-bold text-pastel-brown/75">{notice}</p>}
    </div>
  );
}
