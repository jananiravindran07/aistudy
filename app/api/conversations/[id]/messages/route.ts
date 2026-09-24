import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { withApiError } from '@/lib/handler';
import { requireUser } from '@/lib/auth';
import { requireOwnedConversation } from '@/lib/conversations';
import { parseBody, sendMessageSchema } from '@/lib/validation';
import { complete } from '@/lib/llm';
import { systemPromptFor } from '@/lib/prompts';
import { rateLimit } from '@/lib/rate-limit';
import type { Message } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const HISTORY_LIMIT = 12;

export async function POST(request: Request, ctx: RouteContext) {
  return withApiError(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const conversation = await requireOwnedConversation(id, user.id);

    const rl = rateLimit(`chat:${user.id}`, 30, 60_000);
    if (!rl.allowed) {
      throw new AppError(429, 'You are sending messages very quickly. Take a breath and try again in a moment.', {
        code: 'rate_limited',
        retryable: true,
      });
    }

    const body = await request.json().catch(() => null);
    const parsed = parseBody(sendMessageSchema, body);
    if (!parsed.ok) {
      throw new AppError(400, parsed.message, { code: 'validation', retryable: false });
    }
    const content = parsed.data.content;

    // Build the conversational history from the DB
    const recent = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });
    // chronological, excluding nothing — the user's new message is appended below
    const history = [...recent].reverse().map((m) => ({ role: m.role, content: m.content }));

    const userMessage = await prisma.message.create({
      data: { conversationId: id, role: 'user', content },
    });

    const result = await complete({
      system: systemPromptFor('chat', conversation.topic, conversation.difficulty as 'Beginner' | 'Intermediate' | 'Advanced', conversation.sourceText),
      history: [...history, { role: 'user', content }],
      temperature: 0.7,
      maxTokens: 1600,
      seed: { mode: 'chat', topic: conversation.topic, difficulty: conversation.difficulty as 'Beginner' | 'Intermediate' | 'Advanced' },
    });

    const assistantMessage = await prisma.message.create({
      data: { conversationId: id, role: 'assistant', content: result.content },
    });

    const toDto = (m: { id: string; role: string; content: string; createdAt: Date }): Message => ({
      id: m.id,
      role: m.role as Message['role'],
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    });

    return Response.json({
      userMessage: toDto(userMessage),
      assistantMessage: toDto(assistantMessage),
      mocked: result.mocked,
    });
  });
}