import { z } from 'zod';

export const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const MODES = ['explain', 'notes', 'quiz', 'plan'] as const;
export type Mode = (typeof MODES)[number];

export const difficultySchema = z.enum(DIFFICULTIES);

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please enter your name.')
    .max(60, 'Name must be 60 characters or fewer.')
    .transform((s) => s.replace(/\s+/g, ' ')),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'Email is too long.')
    .pipe(z.email('Please enter a valid email address.')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be 72 characters or fewer.'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Please enter a valid email address.')),
  password: z.string().min(1, 'Please enter your password.'),
});

export const createConversationSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(1, 'Please enter a topic.')
    .max(200, 'Topic must be 200 characters or fewer.'),
  difficulty: difficultySchema.default('Beginner'),
});

export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty.')
    .max(4000, 'Message must be 4000 characters or fewer.'),
});

export const generateSchema = z.object({
  conversationId: z.string().min(1),
  mode: z.enum(MODES),
});

/**
 * Parse an unknown request body against a schema.
 * Returns `{ ok: true, data }` or `{ ok: false, message }` with the first
 * human-readable validation message.
 */
export function parseBody<T>(schema: z.ZodType<T>, data: unknown): { ok: true; data: T } | { ok: false; message: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, message: first ? first.message : 'Invalid request.' };
  }
  return { ok: true, data: result.data };
}