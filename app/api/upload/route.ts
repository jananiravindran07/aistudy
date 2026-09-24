import { PDFParse } from 'pdf-parse';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { withApiError } from '@/lib/handler';
import { requireUser } from '@/lib/auth';
import { difficultySchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import type { ConversationSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_EXTRACTED_CHARS = 100_000;

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

async function extractText(filename: string, bytes: Uint8Array): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.txt')) {
    // strip BOM and NULs; decode as UTF-8
    return Buffer.from(bytes).toString('utf8').replace(/\u0000/g, '').trim();
  }
  if (lower.endsWith('.pdf')) {
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      return result.text.replace(/\u0000/g, '').trim();
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }
  throw new AppError(415, 'Only .txt and .pdf files are supported.', { code: 'unsupported_type', retryable: false });
}

/**
 * POST /api/upload
 * multipart/form-data: file (.txt|.pdf), optional title, optional difficulty
 *
 * Extracts the file's text server-side and stores it with the conversation
 * so all LLM calls are grounded in that content.
 */
export async function POST(request: Request) {
  return withApiError(async () => {
    const user = await requireUser();
    const rl = rateLimit(`upload:${user.id}`, 10, 60_000);
    if (!rl.allowed) {
      throw new AppError(429, 'Too many uploads. Please wait a moment.', { code: 'rate_limited', retryable: true });
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new AppError(400, 'Expected multipart form data with a "file" field.', { code: 'validation', retryable: false });
    }

    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new AppError(400, 'Please attach a .txt or .pdf file.', { code: 'validation', retryable: false });
    }

    if (file.size > MAX_FILE_BYTES) {
      throw new AppError(413, 'That file is larger than 5 MB. Please upload a smaller file.', {
        code: 'file_too_large',
        retryable: false,
      });
    }

    const titleField = form.get('title');
    const title = typeof titleField === 'string' && titleField.trim() ? titleField.trim().slice(0, 80) : '';
    const difficultyRaw = typeof form.get('difficulty') === 'string' ? String(form.get('difficulty')) : 'Beginner';
    const difficultyParsed = difficultySchema.safeParse(difficultyRaw);
    const difficulty = difficultyParsed.success ? difficultyParsed.data : 'Beginner';

    const buffer = new Uint8Array(await file.arrayBuffer());
    let text: string;
    try {
      text = await extractText(file.name, buffer);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(422, 'We could not read that PDF. It may be corrupt or password-protected.', {
        code: 'parse_failed',
        retryable: false,
        cause: err,
      });
    }

    if (!text) {
      throw new AppError(422, 'No readable text was found in that file.', { code: 'empty_document', retryable: false });
    }

    const truncated = text.length > MAX_EXTRACTED_CHARS ? text.slice(0, MAX_EXTRACTED_CHARS) : text;
    const wordCount = truncated.split(/\s+/).filter(Boolean).length;

    const conversationTitle = title || file.name.replace(/\.(txt|pdf)$/i, '');
    const greeting =
      `I've read **${file.name}** (about ${wordCount.toLocaleString()} words) and I'm ready to help you study it. ` +
      `Ask me questions about the document, or generate notes, a quiz, or a study plan based on this material.`;

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: conversationTitle.slice(0, 80),
        topic: conversationTitle,
        difficulty,
        sourceText: truncated,
        messages: { create: { role: 'assistant', content: greeting } },
      },
    });

    return Response.json(toSummary(conversation), { status: 201 });
  });
}