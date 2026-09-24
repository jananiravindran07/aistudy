import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { withApiError } from '@/lib/handler';
import { requireUser } from '@/lib/auth';
import { createConversationSchema, parseBody } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import type { ConversationSummary } from '@/lib/types';

function toSummary(c: {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  sourceText: string | null;
  createdAt: Date;
}): ConversationSummary {
  return {
    id: c.id,
    title: c.title,
    topic: c.topic,
    difficulty: c.difficulty as ConversationSummary['difficulty'],
    sourceText: c.sourceText,
    createdAt: c.createdAt.toISOString(),
  };
}

export const dynamic = 'force-dynamic';

export async function GET() {
  return withApiError(async () => {
    const user = await requireUser();
    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return Response.json(conversations.map(toSummary));
  });
}

export async function POST(request: Request) {
  return withApiError(async () => {
    const user = await requireUser();
    const rl = rateLimit(`create:${user.id}`, 20, 60_000);
    if (!rl.allowed) {
      throw new AppError(429, 'You are creating conversations a bit too quickly. Please slow down.', {
        code: 'rate_limited',
        retryable: true,
      });
    }

    const body = await request.json().catch(() => null);
    const parsed = parseBody(createConversationSchema, body);
    if (!parsed.ok) {
      throw new AppError(400, parsed.message, { code: 'validation', retryable: false });
    }
    const { topic, difficulty } = parsed.data;

    const greeting =
      `I'm your AI study buddy for **"${topic}"** at the **${difficulty}** level.\n\n` +
      `Ask me anything about it, or use the actions below to generate explain, notes, a quiz, or a study plan.`;

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: topic.slice(0, 60),
        topic,
        difficulty,
        messages: {
          create: { role: 'assistant', content: greeting },
        },
      },
    });

    return Response.json(toSummary(conversation), { status: 201 });
  });
}