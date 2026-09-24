import { withApiError } from '@/lib/handler';
import { requireUser } from '@/lib/auth';
import { requireOwnedConversation } from '@/lib/conversations';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { buildMarkdown, type ExportType } from '@/lib/export';
import type { Note, Quiz, StudyPlan } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/conversations/[id]/export?type=notes|quiz|plan
 * Downloads the requested artifact as a Markdown file.
 */
export async function GET(request: Request, ctx: RouteContext) {
  return withApiError(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const conversation = await requireOwnedConversation(id, user.id);

    const type = new URL(request.url).searchParams.get('type');
    if (type !== 'notes' && type !== 'quiz' && type !== 'plan') {
      throw new AppError(400, 'Use ?type=notes, ?type=quiz or ?type=plan.', { code: 'validation', retryable: false });
    }

    const [note, quiz, plan] = await Promise.all([
      prisma.note.findFirst({ where: { conversationId: id }, orderBy: { createdAt: 'desc' } }),
      prisma.quiz.findFirst({ where: { conversationId: id }, orderBy: { createdAt: 'desc' } }),
      prisma.studyPlan.findFirst({ where: { conversationId: id }, orderBy: { createdAt: 'desc' } }),
    ]);

    const noteDto: Note | null = note
      ? {
          id: note.id,
          conversationId: note.conversationId,
          content: note.content,
          createdAt: note.createdAt.toISOString(),
        }
      : null;

    const quizDto: Quiz | null = quiz
      ? {
          id: quiz.id,
          conversationId: quiz.conversationId,
          questions: quiz.questions as unknown as Quiz['questions'],
          createdAt: quiz.createdAt.toISOString(),
        }
      : null;

    const planDto: StudyPlan | null = plan
      ? {
          id: plan.id,
          conversationId: plan.conversationId,
          content: plan.content as unknown as StudyPlan['content'],
          createdAt: plan.createdAt.toISOString(),
        }
      : null;

    const built = buildMarkdown(conversation.topic, type as ExportType, noteDto, quizDto, planDto);
    if (!built) {
      throw new AppError(404, 'Nothing to export yet — generate it first.', { code: 'not_found', retryable: false });
    }

    return new Response(built.content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${built.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}