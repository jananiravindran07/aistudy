import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from './api';

export interface User {
  id: string;
  email: string;
  name: string | null;
  carrots: number;
  happiness: number;
  level: number;
}

export interface StudyTask {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  feedCapybara: () => Promise<void>;
  updateCarrots: (amount: number) => Promise<void>;
  addTask: (title: string) => Promise<StudyTask>;
  setTaskCompleted: (id: string, completed: boolean) => Promise<boolean>;
  removeTask: (id: string) => Promise<void>;
  completeSession: (duration: number, goal?: string) => Promise<{ carrotsAwarded: number; streak: number }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authRevision = useRef(0);

  useEffect(() => {
    const revision = authRevision.current;
    api.get<{ user: User }>('/auth/me')
      .then(({ data }) => {
        if (authRevision.current === revision) setUser(data.user);
      })
      .catch(() => {
        if (authRevision.current === revision) setUser(null);
      })
      .finally(() => {
        if (authRevision.current === revision) setIsLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post<{ user: User }>('/auth/login', { email, password });
    authRevision.current += 1;
    setUser(data.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const { data } = await api.post<{ user: User }>('/auth/register', { name, email, password });
    authRevision.current += 1;
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      authRevision.current += 1;
      setUser(null);
    }
  };

  const feedCapybara = async () => {
    if (!user || user.carrots < 1) return;
    const { data } = await api.post<{ user: User }>('/capybara/feed');
    setUser(data.user);
  };

  const updateCarrots = async (amount: number) => {
    if (!user || amount < 1) return;
    const { data } = await api.post<{ carrots: number }>('/capybara/update-carrots', { amount });
    setUser((current) => current ? { ...current, carrots: data.carrots } : current);
  };

  const addTask = async (title: string) => {
    const { data } = await api.post<{ task: StudyTask }>('/tasks', { title });
    return data.task;
  };

  const setTaskCompleted = async (id: string, completed: boolean) => {
    const { data } = await api.patch<{ task: StudyTask; carrotAwarded: boolean; carrots: number | null }>(`/tasks/${id}`, { completed });
    if (data.carrots !== null) {
      setUser((current) => current ? { ...current, carrots: data.carrots! } : current);
    }
    return data.carrotAwarded;
  };

  const removeTask = async (id: string) => {
    await api.delete(`/tasks/${id}`);
  };

  const completeSession = async (duration: number, goal?: string) => {
    const { data } = await api.post<{ carrots: number; carrotsAwarded: number; streak: number }>('/sessions/complete', { duration, goal });
    setUser((current) => current ? { ...current, carrots: data.carrots } : current);
    return { carrotsAwarded: data.carrotsAwarded, streak: data.streak };
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, feedCapybara, updateCarrots, addTask, setTaskCompleted, removeTask, completeSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
