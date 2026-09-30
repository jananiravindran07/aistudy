import { useState, useEffect, type KeyboardEvent } from 'react';
import { type StudyTask, useAuth } from '../context/AuthContext';
import { api } from '../context/api';
import { Check, Plus, Trash2 } from 'lucide-react';

export default function TodoList() {
  const { addTask: createTask, setTaskCompleted, removeTask } = useAuth();
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [pendingTask, setPendingTask] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get<{ tasks: StudyTask[] }>('/tasks')
      .then(({ data }) => { if (active) setTasks(data.tasks); })
      .catch(() => { if (active) setError('Could not load tasks. Please try again.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const addTask = async () => {
    if (!newTaskText.trim()) return;
    setError('');
    try {
      const task = await createTask(newTaskText.trim());
      setTasks((current) => [task, ...current]);
      setNewTaskText('');
    } catch {
      setError('Could not add this task. Please try again.');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      addTask();
    }
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    setPendingTask(id);
    setError('');
    try {
      await setTaskCompleted(id, !task.completed);
      setTasks((current) => current.map((item) => item.id === id
        ? { ...item, completed: !task.completed, completedAt: !task.completed ? new Date().toISOString() : null }
        : item));
    } catch {
      setError('Could not update this task. Please try again.');
    } finally {
      setPendingTask(null);
    }
  };

  const deleteTask = async (id: string) => {
    setPendingTask(id);
    setError('');
    try {
      await removeTask(id);
      setTasks((current) => current.filter((task) => task.id !== id));
    } catch {
      setError('Could not delete this task. Please try again.');
    } finally {
      setPendingTask(null);
    }
  };

  return (
    <div className="card border-pastel-pink">
      <h3 className="text-lg font-bold text-pastel-orange mb-4 flex items-center justify-between">
        To-Do List
        <span className="text-xs bg-pastel-cream text-pastel-brown/70 px-2 py-1 rounded-full">
          1 task = 1 🥕
        </span>
      </h3>
      {error && <p role="alert" className="form-error mb-3">{error}</p>}
      
      <div className="flex gap-2 mb-4">
        <input 
          type="text" 
          placeholder="Add a task..." 
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={160}
          className="flex-grow text-sm px-3 py-2 rounded-xl border-2 border-pastel-pink/30 focus:border-pastel-pink focus:outline-none bg-white/50"
        />
        <button 
          onClick={addTask}
          disabled={!newTaskText.trim() || isLoading}
          className="bg-pastel-pink text-white p-2 rounded-xl shadow-sm hover:bg-pastel-pink/80 disabled:opacity-50 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="py-3 text-center text-sm font-bold text-pastel-brown/60" role="status">Loading your tasks...</p>
        ) : tasks.length === 0 ? (
          <p className="text-center text-sm text-pastel-brown/50 italic py-2">
            No tasks yet. Let's get things done!
          </p>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="group flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-pastel-cream/50">
              <button 
                onClick={() => toggleTask(task.id)}
                disabled={pendingTask === task.id}
                aria-label={`${task.completed ? 'Reopen' : 'Complete'} ${task.title}`}
                aria-pressed={task.completed}
                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${task.completed ? 'bg-pastel-mint border-pastel-mint text-white' : 'border-pastel-brown/30 hover:border-pastel-mint'}`}
              >
                {task.completed && <Check size={14} strokeWidth={3} />}
              </button>
              <span className={`flex-grow text-sm ${task.completed ? 'line-through text-pastel-brown/40' : 'text-pastel-brown'}`}>
                {task.title}
              </span>
              <button 
                onClick={() => deleteTask(task.id)}
                disabled={pendingTask === task.id}
                aria-label={`Delete ${task.title}`}
                className="p-1 text-red-300 opacity-100 transition-opacity hover:text-red-500 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
