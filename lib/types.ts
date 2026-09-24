/** Shared types used across the server API and the client UI. */

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type Role = 'user' | 'assistant';
export type Mode = 'explain' | 'notes' | 'quiz' | 'plan';
export type GenerateMode = 'chat' | Mode;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  sourceText: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Quiz {
  id: string;
  conversationId: string;
  questions: QuizQuestion[];
  createdAt: string;
}

export interface StudyPlanDay {
  day: number;
  title?: string;
  focused?: boolean;
  topics: string[];
  tasks: string[];
}

export interface StudyPlan {
  id: string;
  conversationId: string;
  content: StudyPlanDay[];
  createdAt: string;
}

export interface Note {
  id: string;
  conversationId: string;
  content: string;
  createdAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: Message[];
  note: Note | null;
  quiz: Quiz | null;
  plan: StudyPlan | null;
}

/** Shape of an API error body: { error: { message, code, retryable } } */
export interface ApiErrorBody {
  error: {
    message: string;
    code: string;
    retryable: boolean;
  };
}

export interface GenerateResponse {
  ok: true;
  conversationId: string;
  mode: GenerateMode;
  message?: Message; // chat / explain responses land in the chat
  note?: Note;
  quiz?: Quiz;
  plan?: StudyPlan;
  mocked?: boolean;
}