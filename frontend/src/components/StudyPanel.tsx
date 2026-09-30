import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, FileText, HelpCircle, Calendar, Send, Loader2, RefreshCw, Plus, Pencil, Trash2, Check, X, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../context/api';
import type { CapybaraState } from './Capybara';

type Mode = 'explain' | 'notes' | 'quiz' | 'plan';
type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuizResult {
  questions: QuizQuestion[];
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  _count?: { messages: number };
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface StudyDocument {
  id: string;
  title: string;
  createdAt: string;
}

interface StudyPanelProps {
  onCapybaraStateChange?: (state: CapybaraState) => void;
}

const MODES: { id: Mode; label: string; icon: React.ReactNode; color: string; description: string }[] = [
  { id: 'explain', label: 'Explain', icon: <BookOpen size={16} />, color: 'pastel-blue', description: 'Clear explanations with examples' },
  { id: 'notes', label: 'Notes', icon: <FileText size={16} />, color: 'pastel-green', description: 'Concise bullet-point notes' },
  { id: 'quiz', label: 'Quiz Me', icon: <HelpCircle size={16} />, color: 'pastel-pink', description: '5-question multiple choice quiz' },
  { id: 'plan', label: 'Study Plan', icon: <Calendar size={16} />, color: 'pastel-peach', description: 'Personalized day-by-day schedule' },
];

const DIFFICULTIES: Difficulty[] = ['Beginner', 'Intermediate', 'Advanced'];
const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  Beginner: '#a8d8a8',
  Intermediate: '#ffd8a8',
  Advanced: '#d8a8d8',
};

export default function StudyPanel({ onCapybaraStateChange }: StudyPanelProps) {
  const { updateCarrots } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversationError, setConversationError] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documentError, setDocumentError] = useState('');
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<Mode>('explain');
  const [difficulty, setDifficulty] = useState<Difficulty>('Intermediate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results
  const [textResult, setTextResult] = useState<string | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showExplanations, setShowExplanations] = useState<Record<number, boolean>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [rewardGiven, setRewardGiven] = useState(false);

  // Plan extra params
  const [planDays, setPlanDays] = useState(7);
  const [planHours, setPlanHours] = useState(2);
  const [planGoal, setPlanGoal] = useState('');

  const topicRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    api.get<{ conversations: Conversation[] }>('/conversations')
      .then(({ data }) => {
        if (!active) return;
        setConversations(data.conversations);
        if (data.conversations[0]) setActiveConversationId(data.conversations[0].id);
      })
      .catch(() => { if (active) setConversationError('Could not load your chats.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    api.get<{ documents: StudyDocument[] }>('/documents')
      .then(({ data }) => { if (active) setDocuments(data.documents); })
      .catch(() => { if (active) setDocumentError('Could not load your documents.'); });
    return () => { active = false; };
  }, []);

  const handleDocumentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setDocumentError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post<{ document: StudyDocument; extractedCharacters: number }>('/documents', formData);
      setDocuments((current) => [data.document, ...current]);
      setSelectedDocumentId(data.document.id);
      setMode('notes');
      setTopic(`Create study notes from ${data.document.title}`);
      setTextResult(null);
      setQuizResult(null);
    } catch (requestError) {
      setDocumentError(axiosErrorMessage(requestError));
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    let active = true;
    api.get<{ messages: ConversationMessage[] }>(`/conversations/${activeConversationId}/messages`)
      .then(({ data }) => { if (active) setMessages(data.messages); })
      .catch(() => { if (active) setConversationError('Could not load this conversation.'); });
    return () => { active = false; };
  }, [activeConversationId]);

  const handleNewConversation = async () => {
    setConversationError('');
    try {
      const { data } = await api.post<{ conversation: Conversation }>('/conversations', { title: 'New chat' });
      setConversations((current) => [data.conversation, ...current]);
      setActiveConversationId(data.conversation.id);
      reset();
    } catch {
      setConversationError('Could not start a new chat. Please try again.');
    }
  };

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renamingId || !renameValue.trim()) return;
    try {
      const { data } = await api.patch<{ conversation: Conversation }>(`/conversations/${renamingId}`, { title: renameValue.trim() });
      setConversations((current) => current.map((conversation) => conversation.id === renamingId ? data.conversation : conversation));
      setRenamingId(null);
    } catch {
      setConversationError('Could not rename this chat. Please try again.');
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await api.delete(`/conversations/${id}`);
      const remaining = conversations.filter((conversation) => conversation.id !== id);
      setConversations(remaining);
      if (activeConversationId === id) {
        setActiveConversationId(remaining[0]?.id ?? null);
        reset();
      }
    } catch {
      setConversationError('Could not delete this chat. Please try again.');
    }
  };

  const handleSubmit = async () => {
    const trimmed = topic.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setTextResult(null);
    setQuizResult(null);
    setSelectedAnswers({});
    setShowExplanations({});
    setQuizScore(null);
    setCurrentQuestionIndex(0);
    setRewardGiven(false);
    onCapybaraStateChange?.('thinking');

    try {
      const requestBody = selectedDocumentId
        ? { question: trimmed, mode, difficulty }
        : {
          topic: trimmed,
          mode,
          difficulty,
          ...(activeConversationId ? { conversationId: activeConversationId } : {}),
          ...(mode === 'plan' ? { extraParams: { days: planDays, hours: planHours, goal: planGoal } } : {}),
        };
      const endpoint = selectedDocumentId ? `/documents/${selectedDocumentId}/ask` : '/study';
      const { data } = await api.post<{ result: string | QuizResult; conversationId: string; messages: ConversationMessage[] }>(endpoint, requestBody);
      setActiveConversationId(data.conversationId);
      setMessages((current) => [...current, ...data.messages]);
      setConversations((current) => {
        const existing = current.find((conversation) => conversation.id === data.conversationId);
        if (existing) return [{ ...existing, updatedAt: new Date().toISOString() }, ...current.filter((conversation) => conversation.id !== data.conversationId)];
        return [{ id: data.conversationId, title: trimmed.slice(0, 80), updatedAt: new Date().toISOString(), _count: { messages: 2 } }, ...current];
      });

      if (mode === 'quiz') {
        setQuizResult(data.result as QuizResult);
      } else {
        setTextResult(data.result as string);
      }
      onCapybaraStateChange?.('happy');
    } catch (requestError) {
      setError(axiosErrorMessage(requestError));
      onCapybaraStateChange?.('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => { void handleSubmit(); };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const handleAnswerSelect = (qIdx: number, optIdx: number) => {
    if (selectedAnswers[qIdx] !== undefined) return; // locked in
    const newAnswers = { ...selectedAnswers, [qIdx]: optIdx };
    setSelectedAnswers(newAnswers);
    setShowExplanations({ ...showExplanations, [qIdx]: true });

    // Check if all answered
    if (quizResult && Object.keys(newAnswers).length === quizResult.questions.length) {
      const correct = quizResult.questions.filter((q, i) => newAnswers[i] === q.correctAnswer).length;
      setQuizScore(correct);

      if (!rewardGiven) {
        const carrots = correct === quizResult.questions.length ? 3 : 0;
        if (carrots > 0) {
          updateCarrots(carrots);
          onCapybaraStateChange?.('happy');
        }
        setRewardGiven(true);
      }
    }
  };

  const reset = () => {
    setTextResult(null);
    setQuizResult(null);
    setSelectedAnswers({});
    setShowExplanations({});
    setQuizScore(null);
    setCurrentQuestionIndex(0);
    setRewardGiven(false);
  };

  const hasResult = textResult !== null || quizResult !== null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
      <aside className="flex min-h-0 flex-col border-b border-pastel-peach/40 pb-3 lg:w-48 lg:shrink-0 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-extrabold text-pastel-brown">Your chats</h3>
          <button type="button" onClick={handleNewConversation} aria-label="New chat" title="New chat" className="icon-button size-9">
            <Plus size={17} />
          </button>
        </div>
        {conversationError && <p role="alert" className="mb-2 text-xs font-bold text-[#8c4131]">{conversationError}</p>}
        <nav aria-label="Saved conversations" className="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
          {conversations.map((conversation) => (
            <div key={conversation.id} className={`group flex min-w-40 items-center gap-1 rounded-xl border px-2 py-1.5 lg:min-w-0 ${activeConversationId === conversation.id ? 'border-pastel-peach bg-pastel-peach/30' : 'border-transparent hover:bg-white/60'}`}>
              {renamingId === conversation.id ? (
                <form onSubmit={handleRename} className="flex min-w-0 flex-1 items-center gap-1">
                  <input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={100} aria-label="Rename chat" className="min-w-0 flex-1 rounded-md border border-pastel-peach bg-white px-1.5 py-1 text-xs" />
                  <button type="submit" aria-label="Save chat name" className="text-pastel-brown"><Check size={14} /></button>
                  <button type="button" aria-label="Cancel rename" onClick={() => setRenamingId(null)} className="text-pastel-brown/60"><X size={14} /></button>
                </form>
              ) : (
                <>
                  <button type="button" onClick={() => { setActiveConversationId(conversation.id); reset(); }} className="min-w-0 flex-1 truncate text-left text-xs font-bold text-pastel-brown" title={conversation.title}>
                    {conversation.title}
                  </button>
                  <button type="button" aria-label={`Rename ${conversation.title}`} onClick={() => { setRenamingId(conversation.id); setRenameValue(conversation.title); }} className="rounded p-1 text-pastel-brown/45 hover:text-pastel-brown">
                    <Pencil size={13} />
                  </button>
                  <button type="button" aria-label={`Delete ${conversation.title}`} onClick={() => { void handleDeleteConversation(conversation.id); }} className="rounded p-1 text-pastel-brown/45 hover:text-[#9c4f40]">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
          {conversations.length === 0 && <p className="hidden py-3 text-xs leading-relaxed text-pastel-brown/55 lg:block">Your study chats will show up here.</p>}
        </nav>
          <section className="mt-4 border-t border-pastel-peach/50 pt-3" aria-label="Study documents">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-extrabold text-pastel-brown">Documents</h3>
              <label className={`icon-button size-9 cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`} aria-label="Upload a study document" title="Upload PDF, TXT, or MD">
                <Upload size={16} aria-hidden="true" />
                <input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={handleDocumentUpload} disabled={uploading} className="sr-only" aria-label="Upload PDF, TXT, or MD file" />
              </label>
            </div>
            {uploading && <p role="status" className="mb-2 text-xs font-bold text-pastel-brown/60">Reading your file...</p>}
            {documentError && <p role="alert" className="mb-2 text-xs font-bold text-[#8c4131]">{documentError}</p>}
            <div className="max-h-36 space-y-1 overflow-y-auto">
              {documents.map((document) => (
                <div key={document.id} className={`rounded-lg border px-2 py-1.5 ${selectedDocumentId === document.id ? 'border-pastel-mint bg-pastel-mint/30' : 'border-transparent'}`}>
                  <p className="truncate text-xs font-bold text-pastel-brown" title={document.title}>{document.title}</p>
                  <div className="mt-1 flex gap-1">
                    <button type="button" onClick={() => { setSelectedDocumentId(document.id); setMode('notes'); setTopic(`Create study notes from ${document.title}`); }} className="rounded-md bg-white/75 px-2 py-1 text-[10px] font-bold text-pastel-brown hover:bg-pastel-peach/40">Notes</button>
                    <button type="button" onClick={() => { setSelectedDocumentId(document.id); setMode('quiz'); setTopic(`Create a quiz from ${document.title}`); }} className="rounded-md bg-white/75 px-2 py-1 text-[10px] font-bold text-pastel-brown hover:bg-pastel-peach/40">Quiz</button>
                    <button type="button" onClick={() => { setSelectedDocumentId(document.id); setTopic(`Answer my question using ${document.title}`); }} className="rounded-md bg-white/75 px-2 py-1 text-[10px] font-bold text-pastel-brown hover:bg-pastel-peach/40">Ask</button>
                  </div>
                </div>
              ))}
              {!documents.length && !uploading && <p className="text-xs leading-relaxed text-pastel-brown/55">Upload a PDF, TXT, or MD file to study from it.</p>}
            </div>
            {selectedDocumentId && <button type="button" onClick={() => setSelectedDocumentId(null)} className="mt-2 text-[10px] font-bold text-pastel-brown/60 underline">Switch back to topic study</button>}
          </section>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Mode Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); reset(); }}
            title={m.description}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
              mode === m.id
                ? 'bg-pastel-orange text-white border-pastel-orange shadow-md scale-105'
                : 'bg-white/60 text-pastel-brown border-pastel-peach/40 hover:border-pastel-orange hover:bg-white'
            }`}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {/* Difficulty */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-semibold text-pastel-brown/60 uppercase tracking-wide">Level:</span>
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 ${
              difficulty === d
                ? 'text-white shadow-md scale-105'
                : 'bg-white/60 text-pastel-brown/70 hover:scale-105'
            }`}
            style={difficulty === d ? { backgroundColor: DIFFICULTY_COLORS[d], color: '#5a3e2b' } : {}}
          >
            {d}
          </button>
        ))}
        {mode === 'plan' && (
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-pastel-brown/70">
            <label>Days <input type="number" min={1} max={30} value={planDays} onChange={e => setPlanDays(+e.target.value)} className="w-12 rounded border border-pastel-peach/50 bg-white/60 px-1 text-center" /></label>
            <label>Hrs/day <input type="number" min={0.5} max={12} step={0.5} value={planHours} onChange={e => setPlanHours(+e.target.value)} className="w-12 rounded border border-pastel-peach/50 bg-white/60 px-1 text-center" /></label>
            <label className="sr-only" htmlFor="plan-goal">Study goal</label>
            <input id="plan-goal" value={planGoal} onChange={(event) => setPlanGoal(event.target.value)} maxLength={240} placeholder="Your goal" className="w-28 rounded border border-pastel-peach/50 bg-white/60 px-2 py-1" />
          </div>
        )}
      </div>

      {/* Main scrollable content area */}
      <div className="flex-1 overflow-y-auto min-h-0 mb-4">
        <AnimatePresence mode="wait">
          {!hasResult && !loading && !error && messages.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center h-full text-center py-12"
            >
              <div className="text-6xl mb-4">🦫</div>
              <h3 className="text-xl font-bold text-pastel-orange mb-2">What are we studying today?</h3>
              <p className="text-pastel-brown/60 max-w-xs text-sm">
                {mode === 'explain' && 'Type a topic and I\'ll give you a clear explanation with examples!'}
                {mode === 'notes' && 'Type a topic and I\'ll create concise bullet-point notes!'}
                {mode === 'quiz' && 'Type a topic and I\'ll quiz you with 5 multiple choice questions!'}
                {mode === 'plan' && 'Type a topic and I\'ll build you a personalized study plan!'}
              </p>
            </motion.div>
          )}

          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full py-12"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                className="mb-4"
              >
                <Loader2 size={40} className="text-pastel-orange" />
              </motion.div>
              <p className="text-pastel-brown/70 font-medium">Your capybara is thinking… 🦫✨</p>
              <p className="text-pastel-brown/40 text-sm mt-1">Generating {mode} for "{topic}"</p>
            </motion.div>
          )}

          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="m-4 p-4 rounded-2xl bg-red-50 border-2 border-red-200 text-red-700"
            >
              <p className="font-semibold mb-1">Oops! Something went wrong 😿</p>
              <p className="text-sm">{error}</p>
              <button type="button" onClick={handleRetry} className="btn-secondary mt-3 inline-flex items-center gap-2 text-sm"><RefreshCw size={15} /> Try again</button>
            </motion.div>
          )}

          {!hasResult && messages.length > 0 && !loading && (
            <div className="space-y-3 p-3" aria-label="Conversation history">
              {messages.map((message) => (
                <div key={message.id} className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === 'user' ? 'ml-auto bg-pastel-peach/50 text-pastel-brown' : 'mr-auto border border-pastel-mint/70 bg-white/75 text-pastel-brown/85'}`}>
                  <p className="mb-1 text-[10px] font-extrabold uppercase text-pastel-brown/50">{message.role === 'user' ? 'You' : 'Study buddy'}</p>
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              ))}
            </div>
          )}

          {textResult && (
            <motion.div
              key="text-result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-pastel-brown flex items-center gap-2">
                  {MODES.find(m => m.id === mode)?.icon}
                  <span className="capitalize">{mode}</span>: <span className="text-pastel-orange ml-1">{topic}</span>
                </h4>
                <button onClick={reset} className="text-pastel-brown/40 hover:text-pastel-orange transition-colors" title="Clear">
                  <RefreshCw size={16} />
                </button>
              </div>
              <div className="prose prose-sm max-w-none">
                {textResult.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) return <h3 key={i} className="text-pastel-orange font-bold text-base mt-4 mb-1">{line.slice(3)}</h3>;
                  if (line.startsWith('# ')) return <h2 key={i} className="text-pastel-brown font-bold text-lg mt-4 mb-1">{line.slice(2)}</h2>;
                  if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-pastel-brown mt-2">{line.slice(2,-2)}</p>;
                  if (line.startsWith('- ') || line.startsWith('• ')) return (
                    <div key={i} className="flex gap-2 items-start my-1">
                      <span className="text-pastel-orange mt-0.5">🥕</span>
                      <span className="text-pastel-brown/80 text-sm">{line.slice(2)}</span>
                    </div>
                  );
                  if (line.trim() === '') return <div key={i} className="h-2" />;
                  return <p key={i} className="text-pastel-brown/80 text-sm leading-relaxed">{line}</p>;
                })}
              </div>
            </motion.div>
          )}

          {quizResult && (
            <motion.div
              key="quiz-result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-pastel-brown flex items-center gap-2">
                  <HelpCircle size={16} className="text-pastel-pink" />
                  Quiz: <span className="text-pastel-orange ml-1">{topic}</span>
                </h4>
                <button onClick={reset} className="text-pastel-brown/40 hover:text-pastel-orange transition-colors">
                  <RefreshCw size={16} />
                </button>
              </div>

              {quizScore !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`rounded-2xl p-4 text-center font-bold text-lg border-2 ${
                    quizScore >= 4 ? 'bg-green-50 border-green-300 text-green-700' :
                    quizScore >= 2 ? 'bg-yellow-50 border-yellow-300 text-yellow-700' :
                    'bg-red-50 border-red-300 text-red-700'
                  }`}
                >
                  {quizScore === quizResult.questions.length ? '🎉 ' : '📚 '}
                  {quizScore}/{quizResult.questions.length} — {quizScore === quizResult.questions.length ? 'Perfect score! +3 🥕' : 'Nice work. Review your answers and try again.'}
                </motion.div>
              )}

              {quizScore === null && <div className="mb-4">
                <div className="mb-1 flex justify-between text-xs font-bold text-pastel-brown/65">
                  <span>Question {currentQuestionIndex + 1} of {quizResult.questions.length}</span>
                  <span>{Math.round(((currentQuestionIndex + 1) / quizResult.questions.length) * 100)}%</span>
                </div>
                <div role="progressbar" aria-valuemin={0} aria-valuemax={quizResult.questions.length} aria-valuenow={currentQuestionIndex + 1} className="h-2 overflow-hidden rounded-full bg-pastel-cream">
                  <div className="h-full rounded-full bg-pastel-mint transition-[width] duration-300" style={{ width: `${((currentQuestionIndex + 1) / quizResult.questions.length) * 100}%` }} />
                </div>
              </div>}

              {quizScore === null && quizResult.questions.filter((_, index) => index === currentQuestionIndex).map((q) => {
                const qi = currentQuestionIndex;
                const answered = selectedAnswers[qi] !== undefined;
                const isCorrect = answered && selectedAnswers[qi] === q.correctAnswer;

                return (
                  <motion.div
                    key={qi}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: qi * 0.05 }}
                    className="bg-white/60 rounded-2xl p-4 border-2 border-pastel-peach/30"
                  >
                    <p className="font-semibold text-pastel-brown mb-3 text-sm">
                      <span className="inline-block w-6 h-6 rounded-full bg-pastel-orange text-white text-xs flex items-center justify-center mr-2 font-bold">{qi + 1}</span>
                      {q.question}
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {q.options.map((opt, oi) => {
                        const isSelected = selectedAnswers[qi] === oi;
                        const isCorrectOpt = oi === q.correctAnswer;
                        let optClass = 'border-2 border-pastel-peach/40 bg-white/70 text-pastel-brown hover:border-pastel-orange hover:bg-pastel-peach/20';
                        if (answered) {
                          if (isCorrectOpt) optClass = 'border-2 border-green-400 bg-green-50 text-green-800';
                          else if (isSelected) optClass = 'border-2 border-red-400 bg-red-50 text-red-800';
                          else optClass = 'border-2 border-pastel-peach/20 bg-white/40 text-pastel-brown/40';
                        }

                        return (
                          <button
                            key={oi}
                            onClick={() => handleAnswerSelect(qi, oi)}
                            disabled={answered}
                            className={`text-left px-3 py-2 rounded-xl text-sm transition-all duration-200 ${optClass} ${!answered ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <span className="font-bold mr-2">{String.fromCharCode(65 + oi)}.</span>
                            {opt}
                            {answered && isCorrectOpt && <span className="ml-2">✅</span>}
                            {answered && isSelected && !isCorrect && <span className="ml-2">❌</span>}
                          </button>
                        );
                      })}
                    </div>

                    <AnimatePresence>
                      {showExplanations[qi] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs"
                        >
                          💡 {q.explanation}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {answered && qi < quizResult.questions.length - 1 && (
                      <button type="button" onClick={() => setCurrentQuestionIndex(qi + 1)} className="btn-primary mt-4 px-4 py-2 text-sm">
                        Next question
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="flex gap-2 mt-auto">
        <input
          ref={topicRef}
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Topic to ${mode === 'quiz' ? 'quiz you on' : mode === 'plan' ? 'plan for' : mode}…`}
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-2xl border-2 border-pastel-peach/50 focus:border-pastel-orange focus:outline-none bg-white/70 text-pastel-brown placeholder-pastel-brown/30 text-sm disabled:opacity-50 transition-colors"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !topic.trim()}
          className="px-4 py-3 rounded-2xl bg-pastel-orange text-white font-bold transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 shadow-md"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
      </section>
    </div>
  );
}

function axiosErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = error.response;
    if (typeof response === 'object' && response !== null && 'data' in response) {
      const data = response.data;
      if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') return data.error;
    }
  }
  return error instanceof Error ? error.message : 'Study content could not be generated. Please try again.';
}
