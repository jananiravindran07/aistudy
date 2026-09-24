import OpenAI from 'openai';
import { AppError } from '@/lib/errors';
import type { Difficulty, Mode } from '@/lib/validation';

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompleteOptions {
  system: string;
  history?: HistoryMessage[];
  /** Ask the model for strict JSON output. */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Only used by mock mode to return plausible canned content. */
  seed?: { mode: Mode | 'chat'; topic: string; difficulty: Difficulty };
}

export interface CompletionResult {
  content: string;
  /** True when the content came from built-in mock mode rather than the real API. */
  mocked: boolean;
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AppError(503, 'OPENAI_API_KEY is not configured on the server.', {
      code: 'llm_not_configured',
      retryable: true,
    });
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

function modelName(): string {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

export function llmMockEnabled(): boolean {
  return process.env.LLM_MOCK === 'true';
}

/**
 * Server-side call to the LLM. The API key is read from the environment only —
 * it is never sent to the client.
 */
export async function complete(options: CompleteOptions): Promise<CompletionResult> {
  // Mock mode: deterministic offline responses so the whole flow is testable
  // without an API key (set LLM_MOCK=true in .env).
  if (llmMockEnabled() || !process.env.OPENAI_API_KEY) {
    return { content: mockContent(options), mocked: true };
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: options.system },
    ...(options.history ?? []).map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const response = await getClient().chat.completions.create({
      model: modelName(),
      messages,
      temperature: options.temperature ?? 0.6,
      max_tokens: options.maxTokens ?? 2048,
      ...(options.json ? { response_format: { type: 'json_object' as const } } : {}),
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new AppError(502, 'The model returned an empty response. Please try again.', {
        code: 'llm_empty',
        retryable: true,
      });
    }
    return { content, mocked: false };
  } catch (err) {
    if (err instanceof AppError) throw err;

    const apiError = err as { status?: number; code?: string; message?: string };
    if (apiError.status === 429 || apiError.code === 'rate_limit_exceeded') {
      throw new AppError(429, 'Good news: our AI is in high demand right now. Please wait a moment and try again.', {
        code: 'rate_limited',
        retryable: true,
      });
    }
    if (apiError.status === 401) {
      throw new AppError(503, 'The OpenAI API key on the server was rejected. Check OPENAI_API_KEY in .env.', {
        code: 'llm_auth',
        retryable: false,
      });
    }
    throw new AppError(502, 'The AI service hit an error. Please try again in a moment.', {
      code: 'llm_error',
      retryable: true,
      cause: err,
    });
  }
}

// ---------------------------------------------------------------------------
// Mock mode — canned but plausible output per generation mode.

function mockHeader(seed: CompleteOptions['seed']): string {
  const topic = seed?.topic ?? 'your topic';
  return `> **Mock response** — set \`OPENAI_API_KEY\` in \`.env\` (and \`LLM_MOCK=false\`) to get live AI replies.\n\n`;
}

function mockContent(options: CompleteOptions): string {
  const seed = options.seed;
  const topic = seed?.topic ?? 'your topic';
  const difficulty = seed?.difficulty ?? 'Beginner';

  const base = `This is a canned study-mode response about **${topic}** (difficulty: ${difficulty}). Add your OpenAI API key to .env to enable real AI-generated content.`;

  switch (seed?.mode) {
    case 'explain':
      return (
        mockHeader(seed) +
        `## ${topic}\n\n${base}\n\n**Key idea:** every study plan works best when you map new concepts to things you already know, then practice actively.`
      );
    case 'notes':
      return (
        mockHeader(seed) +
        `**Key takeaways**\n\n- ${topic} is well-understood through concrete examples\n- Break it into small, testable chunks\n- Review actively (quiz yourself) to retain it\n\n## Core concepts\n\n${base}\n\n## Common mistakes\n\n- Skipping practice and just reading\n- Memorizing instead of connecting ideas`
      );
    case 'quiz': {
      const q = (n: number) => ({
        question: `${n}. Which statement about **${topic}** is most accurate?`,
        options: [
          `A: It is best learned by applying it to small examples`,
          `B: It cannot be learned without a specialist`,
          `C: Reading about it once is enough`,
          `D: It has no connection to other subjects`,
        ],
        correctAnswer: `A: It is best learned by applying it to small examples`,
        explanation: `Active practice with ${topic} builds durable understanding far better than passive reading.`,
      });
      return JSON.stringify({ questions: [q(1), q(2), q(3), q(4), q(5)] });
    }
    case 'plan': {
      const days = Array.from({ length: 4 }, (_, i) => ({
        day: i + 1,
        title: `Day ${i + 1}: ${i === 0 ? 'Foundations' : i === 1 ? 'Core practice' : i === 2 ? 'Application' : 'Review & consolidate'}`,
        focused: true,
        topics: [`Core ideas of ${topic}`, `Example walkthroughs`, `Common pitfalls`],
        tasks: [
          `Spend 30–45 minutes reading about ${topic} and taking notes`,
          `Work one practice example by hand`,
          `Explain the concept aloud in your own words`,
          `Summarize one "aha moment" in the chat below`,
        ],
      }));
      return JSON.stringify({ days });
    }
    default:
      return (
        mockHeader(seed) +
        `${base}\n\nTry asking a follow-up question, or generate notes, a quiz, or a study plan for this topic.`
      );
  }
}