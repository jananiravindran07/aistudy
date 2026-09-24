import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';

/**
 * Load a conversation and verify the given user owns it.
 * Throws 404/403 AppErrors otherwise.
 */
export async function requireOwnedConversation(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) {
    throw new AppError(404, 'Conversation not found.', { code: 'not_found', retryable: false });
  }
  if (conversation.userId !== userId) {
    throw new AppError(403, 'You do not have access to this conversation.', {
      code: 'forbidden',
      retryable: false,
    });
  }
  return conversation;
}