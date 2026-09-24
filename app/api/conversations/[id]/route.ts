import { prisma } from '@/lib/db';
import { withApiError } from '@/lib/handler';
import { requireUser } from '@/lib/auth';
import { requireOwnedConversation } from '@/lib/conversations';
import type { ConversationDetail, QuizQuestion, StudyPlanDay } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteContext) {
  return withApiError(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    await requireOwnedConversation(id, user.id);

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        notes: { orderBy: { createdAt: 'desc' }, take: 1 },
        quizzes: { orderBy: { createdAt: 'desc' }, take: 1 },
        studyPlans: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!conversation) {
      return Response.json(
        { error: { message: 'Conversation not found.', code: 'not_found', retryable: false } },
        { status: 404 },
      );
    }

    const note = conversation.notes[0];
    const quiz = conversation.quizzes[0];
    const plan = conversation.studyPlans[0];

    const detail: ConversationDetail = {
      id: conversation.id,
      title: conversation.title,
      topic: conversation.topic,
      difficulty: conversation.difficulty as ConversationDetail['difficulty'],
      sourceText: conversation.sourceText,
      createdAt: conversation.createdAt.toISOString(),
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
      note: note
        ? {
            id: note.id,
            conversationId: note.conversationId,
            content: note.content,
            createdAt: note.createdAt.toISOString(),
          }
        : null,
      quiz: quiz
        ? {
            id: quiz.id,
            conversationId: quiz.conversationId,
            questions: quiz.questions as unknown as QuizQuestion[],
            createdAt: quiz.createdAt.toISOString(),
          }
        : null,
      plan: plan
        ? {
            id: plan.id,
            conversationId: plan.conversationId,
            content: plan.content as unknown as StudyPlanDay[],
            createdAt: plan.createdAt.toISOString(),
          }
        : null,
    };

    return Response.json(detail);
  });
}