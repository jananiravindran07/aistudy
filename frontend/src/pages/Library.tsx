import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { api } from '../context/api';

interface SavedNote { id: string; title: string; content: string; createdAt: string }
interface SavedQuiz { id: string; title: string; questions: string; createdAt: string }
interface SavedPlan { id: string; title: string; content: string; createdAt: string }
type LibraryTab = 'notes' | 'quizzes' | 'plans';

function makeFlashcards(content: string) {
  const bullets = content.split('\n').map((line) => line.trim()).filter((line) => /^[-*•]\s/.test(line));
  const source = bullets.length ? bullets : content.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  return source.map((line, index) => {
    const cleaned = line.replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '');
    const term = cleaned.match(/^\*\*(.+?)\*\*\s*[:—-]\s*(.+)$/);
    return term
      ? { front: term[1], back: term[2] }
      : { front: `Study point ${index + 1}`, back: cleaned.replaceAll('**', '') };
  });
}

export default function Library() {
  const [tab, setTab] = useState<LibraryTab>('notes');
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [quizzes, setQuizzes] = useState<SavedQuiz[]>([]);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [activeNote, setActiveNote] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get<{ notes: SavedNote[]; quizzes: SavedQuiz[]; studyPlans: SavedPlan[] }>('/library')
      .then(({ data }) => {
        if (!active) return;
        setNotes(data.notes);
        setQuizzes(data.quizzes);
        setPlans(data.studyPlans);
      })
      .catch(() => { if (active) setError('Could not load your library. Try again in a moment.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const tabs: { id: LibraryTab; label: string; count: number }[] = [
    { id: 'notes', label: 'Notes', count: notes.length },
    { id: 'quizzes', label: 'Quizzes', count: quizzes.length },
    { id: 'plans', label: 'Study plans', count: plans.length },
  ];
  const currentNote = notes[activeNote];
  const flashcards = currentNote ? makeFlashcards(currentNote.content) : [];
  const displayIndex = Math.min(activeNote, Math.max(0, notes.length - 1));

  const setCard = (index: number) => {
    setActiveNote(index);
    setFlipped(false);
  };

  return (
    <main className="mx-auto max-w-5xl py-2 sm:py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-pastel-peach/60 pb-4">
        <div>
          <span className="auth-kicker">Your saved study material</span>
          <h1 className="text-3xl text-pastel-brown">My Library</h1>
        </div>
        <Link to="/dashboard" className="btn-secondary inline-flex items-center gap-2 text-sm"><ChevronLeft size={16} /> Back to study</Link>
      </div>

      <div role="tablist" aria-label="Library categories" className="mb-6 flex gap-2 overflow-x-auto border-b border-pastel-peach/50">
        {tabs.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-extrabold ${tab === item.id ? 'border-pastel-orange text-pastel-brown' : 'border-transparent text-pastel-brown/55 hover:text-pastel-brown'}`}>
            {item.label}<span className="ml-2 text-xs opacity-60">{item.count}</span>
          </button>
        ))}
      </div>

      {loading && <p className="page-loading" role="status">Gathering your saved notes...</p>}
      {error && <p role="alert" className="form-error">{error}</p>}

      {!loading && !error && tab === 'notes' && (currentNote ? (
        <section aria-label="Flashcards" className="mx-auto max-w-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="truncate font-display text-lg font-extrabold text-pastel-brown">{currentNote.title}</h2>
            <span className="shrink-0 text-xs font-bold text-pastel-brown/55">{displayIndex + 1} / {notes.length}</span>
          </div>
          <button type="button" onClick={() => setFlipped((value) => !value)} aria-label={flipped ? 'Show flashcard front' : 'Flip flashcard to explanation'} aria-pressed={flipped} className="group flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border-2 border-pastel-peach/60 bg-white/80 p-8 text-center shadow-[0_12px_35px_rgba(104,73,47,0.08)] transition-colors hover:bg-white">
            <BookOpen size={24} className="mb-5 text-pastel-orange" aria-hidden="true" />
            <span className="mb-3 text-xs font-extrabold uppercase text-pastel-brown/45">{flipped ? 'Explanation' : 'Term / question'}</span>
            <span className="max-w-xl text-xl font-bold leading-relaxed text-pastel-brown">{flipped ? flashcards[displayIndex]?.back ?? currentNote.content : flashcards[displayIndex]?.front ?? currentNote.title}</span>
            <span className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-pastel-brown/50"><RotateCcw size={14} /> Tap to flip</span>
          </button>
          <div className="mt-3 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setCard((displayIndex - 1 + notes.length) % notes.length)} className="btn-secondary inline-flex items-center gap-1" aria-label="Previous saved note"><ChevronLeft size={18} /> Previous</button>
            <span className="text-xs font-bold text-pastel-brown/55">{flashcards.length} cards</span>
            <button type="button" onClick={() => setCard((displayIndex + 1) % notes.length)} className="btn-secondary inline-flex items-center gap-1" aria-label="Next saved note">Next <ChevronRight size={18} /></button>
          </div>
          <article className="mt-5 rounded-xl border border-pastel-mint/70 bg-pastel-mint/25 p-4">
            <h3 className="mb-1 text-xs font-extrabold uppercase text-pastel-brown/60">Summary</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-pastel-brown/85">{currentNote.content.replace(/^[-*•]\s/gm, '').replaceAll('**', '').slice(0, 900)}</p>
          </article>
        </section>
      ) : <EmptyLibrary message="No notes saved yet. Generate Study Notes and they will appear here." />)}

      {!loading && !error && tab === 'quizzes' && (quizzes.length ? (
        <div className="space-y-3">
          {quizzes.map((quiz) => {
            let questionCount = 0;
            try { questionCount = JSON.parse(quiz.questions).questions?.length ?? 0; } catch { /* Ignore legacy malformed records. */ }
            return <article key={quiz.id} className="flex items-center justify-between gap-3 border-b border-pastel-peach/50 py-4"><div><h2 className="font-extrabold text-pastel-brown">{quiz.title}</h2><p className="mt-1 text-xs text-pastel-brown/60">{questionCount} questions · {new Date(quiz.createdAt).toLocaleDateString()}</p></div><span className="rounded-full bg-pastel-pink/50 px-3 py-1 text-xs font-bold text-pastel-brown">Quiz</span></article>;
          })}
        </div>
      ) : <EmptyLibrary message="No quizzes saved yet. Generate a quiz to add one here." />)}

      {!loading && !error && tab === 'plans' && (plans.length ? (
        <div className="space-y-5">
          {plans.map((plan) => <article key={plan.id} className="border-b border-pastel-peach/50 py-4"><h2 className="mb-2 font-extrabold text-pastel-brown">{plan.title}</h2><p className="whitespace-pre-wrap text-sm leading-relaxed text-pastel-brown/80">{plan.content}</p></article>)}
        </div>
      ) : <EmptyLibrary message="No study plans saved yet. Generate a plan to add one here." />)}
    </main>
  );
}

function EmptyLibrary({ message }: { message: string }) {
  return <div className="mx-auto max-w-lg py-16 text-center"><div className="mb-4 text-4xl" aria-hidden="true">🦫</div><p className="font-bold text-pastel-brown/70">{message}</p><Link to="/dashboard" className="btn-primary mt-5 inline-flex">Start studying</Link></div>;
}