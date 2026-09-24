import { prisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
import { AppError } from '@/lib/errors';
import { withApiError } from '@/lib/handler';
import { requireUser } from '@/lib/auth';
import { requireOwnedConversation } from '@/lib/conversations';
import { generateSchema, parseBody, type Difficulty, type Mode } from '@/lib/validation';
import { complete } from '@/lib/llm';
import { extractJson, systemPromptFor } from '@/lib/prompts';
import { rateLimit } from '@/lib/rate-limit';
import type { GenerateResponse, Message, Note, Quiz, QuizQuestion, StudyPlan, StudyPlanDay } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * POST /api/generate
 * Body: { conversationId, mode } where mode = "explain" | "notes" | "quiz" | "plan"
 *
 * Every mode uses its own system prompt (see lib/prompts.ts). The topic,
 * difficulty, and any uploaded document text are injected server-side.
 */
export async function POST(request: Request, _ctx: RouteContext) {
  return withApiError(async () => {
    const user = await requireUser();
    const rl = rateLimit(`generate:${user.id}`, 15, 60_000);
    if (!rl.allowed) {
      throw new AppError(
        429,
        'You have reached the generation limit for this minute. Please wait a moment and try again.',
        { code: 'rate_limited', retryable: true },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = parseBody(generateSchema, body);
    if (!parsed.ok) {
      throw new AppError(400, parsed.message, { code: 'validation', retryable: false });
    }
    const { conversationId, mode } = parsed.data;

    const conversation = await requireOwnedConversation(conversationId, user.id);
    const difficulty = conversation.difficulty as Difficulty;
    const seed = { mode, topic: conversation.topic, difficulty };

    switch (mode) {
      case 'explain': {
        // Explanation lands in the chat as an assistant bubble.
        const result = await complete({
          system: systemPromptFor('explain', conversation.topic, difficulty, conversation.sourceText),
          temperature: 0.5,
          maxTokens: 1800,
          seed,
        });
        const saved = await prisma.message.create({
          data: { conversationId, role: 'assistant', content: result.content },
        });
        return Response.json({
          ok: true,
          conversationId,
          mode,
          mocked: result.mocked,
          message: toMessage(saved),
        } satisfies GenerateResponse);
      }

      case 'notes': {
        const result = await complete({
          system: systemPromptFor('notes', conversation.topic, difficulty, conversation.sourceText),
          temperature: 0.5,
          maxTokens: 1800,
          seed,
        });
        // Keep a single active note per conversation
        await prisma.note.deleteMany({ where: { conversationId } });
        const note = await prisma.note.create({
          data: { conversationId, content: result.content },
        });
        return Response.json({
          ok: true,
          conversationId,
          mode,
          mocked: result.mocked,
          note: toNote(note),
        } satisfies GenerateResponse);
      }

      case 'quiz': {
        const result = await complete({
          system: systemPromptFor('quiz', conversation.topic, difficulty, conversation.sourceText),
          json: true,
          temperature: 0.6,
          maxTokens: 2500,
          seed,
        });
        const questions = parseQuizPayload(result.content);
        await prisma.quiz.deleteMany({ where: { conversationId } });
        const quiz = await prisma.quiz.create({
          data: { conversationId, questions: questions as unknown as Prisma.InputJsonValue },
        });
        return Response.json({
          ok: true,
          conversationId,
          mode,
          mocked: result.mocked,
          quiz: toQuiz(quiz),
        } satisfies GenerateResponse);
      }

      case 'plan': {
        const result = await complete({
          system: systemPromptFor('plan', conversation.topic, difficulty, conversation.sourceText),
          json: true,
          temperature: 0.6,
          maxTokens: 2500,
          seed,
        });
        const days = parsePlanPayload(result.content);
        await prisma.studyPlan.deleteMany({ where: { conversationId } });
        const plan = await prisma.studyPlan.create({
          data: { conversationId, content: days as unknown as Prisma.InputJsonValue },
        });
        return Response.json({
          ok: true,
          conversationId,
          mode,
          mocked: result.mocked,
          plan: toPlan(plan),
        } satisfies GenerateResponse);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// JSON payload validation (defensive parsing of model output)

function parseQuizPayload(text: string): QuizQuestion[] {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJson(text));
  } catch {
    throw invalidModelOutput('The quiz generator produced unreadable JSON. Please try again.');
  }

  const list = Array.isArray(raw) ? raw : (raw as { questions?: unknown }).questions;
  if (!Array.isArray(list) || list.length < 5 || list.length > 10) {
    throw invalidModelOutput('The quiz generator produced the wrong number of questions. Please try again.');
  }

  const questions: QuizQuestion[] = list.map((item, i) => {
    const q = (item ?? {}) as Record<string, unknown>;
    const options = Array.isArray(q.options) ? q.options.map(String) : [];
    const correct = typeof q.correctAnswer === 'string' ? q.correctAnswer : '';
    if (typeof q.question !== 'string' || options.length !== 4 || !options.includes(correct) || typeof q.explanation !== 'string') {
      throw new AppError(502, `Question ${i + 1} from the AI was malformed. Please try again.`, {
        code: 'llm_bad_json',
        retryable: true,
      });
    }
    return {
      question: q.question,
      options,
      correctAnswer: correct,
      explanation: q.explanation,
    };
  });

  return questions;
}

function parsePlanPayload(text: string): StudyPlanDay[] {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJson(text));
  } catch {
    throw invalidModelOutput('The study planner produced unreadable JSON. Please try again.');
  }

  const list = Array.isArray(raw) ? raw : (raw as { days?: unknown }).days;
  if (!Array.isArray(list) || list.length === 0) {
    throw invalidModelOutput('The study planner produced an empty plan. Please try again.');
  }

  const days: StudyPlanDay[] = list.map((item, i) => {
    const d = (item ?? {}) as Record<string, unknown>;
    const topics = Array.isArray(d.topics) ? d.topics.map(String).filter(Boolean) : [];
    const tasks = Array.isArray(d.tasks) ? d.tasks.map(String).filter(Boolean) : [];
    if (topics.length === 0 || tasks.length === 0) {
      throw new AppError(502, `Day ${i + 1} of the plan was malformed. Please try again.`, {
        code: 'llm_bad_json',
        retryable: true,
      });
    }
    return {
      day: typeof d.day === 'number' ? d.day : i + 1,
      title: typeof d.title === 'string' ? d.title : undefined,
      focused: typeof d.focused === 'boolean' ? d.focused : true,
      topics,
      tasks,
    };
  });

  return days;
}

function invalidModelOutput(message: string): AppError {
  return new AppError(502, message, { code: 'llm_bad_json', retryable: true });
}

// ---------------------------------------------------------------------------

function toMessage(m: { id: string; role: string; content: string; createdAt: Date }): Message {
  return { id: m.id, role: m.role as Message['role'], content: m.content, createdAt: m.createdAt.toISOString() };
}

function toNote(n: { id: string; conversationId: string; content: string; createdAt: Date }): Note {
  return { id: n.id, conversationId: n.conversationId, content: n.content, createdAt: n.createdAt.toISOString() };
}

function toQuiz(q: { id: string; conversationId: string; createdAt: Date }): Quiz {
  const questions = (q as unknown as { questions: QuizQuestion[] }).questions;
  return { id: q.id, conversationId: q.conversationId, questions, createdAt: q.createdAt.toISOString() };
}

function toPlan(p: { id: string; conversationId: string; createdAt: Date }): StudyPlan {
  const content = (p as unknown as { content: StudyPlanDay[] }).content;
  return { id: p.id, conversationId: p.conversationId, content, createdAt: p.createdAt.toISOString() };
}