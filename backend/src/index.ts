import { randomBytes } from 'node:crypto';
import express, { type RequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import path from 'node:path';
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { generateStudyContent } from './services/llm';

dotenv.config();

const app = express();
if (process.env.VERCEL === '1') app.set('trust proxy', 1);
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT ?? 5000);
const production = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET ?? (production ? '' : randomBytes(32).toString('hex'));

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured in production');
}
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is unset; development sessions will expire when the server restarts.');
}

const configuredOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());
const allowedOrigins = production
  ? configuredOrigins
  : [...new Set([...configuredOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173'])];
const cookieOptions = () => ({
  httpOnly: true,
  secure: production,
  sameSite: 'lax' as const,
  path: '/',
});
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const studyLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
const documentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const registerSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(72),
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(72),
});
const studySchema = z.object({
  topic: z.string().trim().min(1).max(12000),
  mode: z.enum(['explain', 'notes', 'quiz', 'plan']),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  conversationId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
  extraParams: z.object({
    days: z.number().int().min(1).max(30).optional(),
    hours: z.number().min(0.5).max(12).optional(),
    goal: z.string().trim().max(240).optional(),
  }).optional(),
});
const carrotSchema = z.object({ amount: z.number().int().min(1).max(100) });
const taskSchema = z.object({ title: z.string().trim().min(1).max(160) });
const taskUpdateSchema = z.object({ completed: z.boolean() });
const conversationSchema = z.object({ title: z.string().trim().min(1).max(100) });
const messageSchema = z.object({ content: z.string().trim().min(1).max(12000), role: z.literal('user') });
const sessionSchema = z.object({
  duration: z.number().int().min(1).max(180),
  goal: z.string().trim().max(240).optional(),
});
const documentAskSchema = z.object({
  question: z.string().trim().min(1).max(12000),
  mode: z.enum(['explain', 'notes', 'quiz', 'plan']),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
});

const authenticate: RequestHandler = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (typeof decoded === 'string' || typeof decoded.userId !== 'string') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.locals.userId = decoded.userId;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const issueSession = (userId: string) => jwt.sign({ userId }, jwtSecret, { expiresIn: '7d' });
const publicUser = (user: { id: string; email: string; name: string | null; carrots: number; happiness: number; level: number }) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  carrots: user.carrots,
  happiness: user.happiness,
  level: user.level,
});
const hasExhaustedAiCredits = (error: unknown) => error instanceof Error
  && /credit_balance_exhausted|insufficient_quota|no credits remaining/i.test(error.message);
const isAiTemporarilyUnavailable = (error: unknown) => typeof error === 'object'
  && error !== null
  && 'status' in error
  && error.status === 503;
const rewardCarrots = async (transaction: Prisma.TransactionClient, userId: string, amount: number) => {
  const user = await transaction.user.update({
    where: { id: userId },
    data: { carrots: { increment: amount } },
  });
  await transaction.capybaraState.upsert({
    where: { userId },
    create: { userId, carrots: user.carrots, happiness: user.happiness, level: user.level },
    update: { carrots: { increment: amount } },
  });
  return user;
};

app.post('/api/auth/register', loginLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid registration details', details: parsed.error.flatten() });

  try {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name?.trim() || null,
        password: await bcrypt.hash(parsed.data.password, 12),
        capybaraState: { create: {} },
      },
    });
    res.cookie('token', issueSession(user.id), { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    console.error('Registration failed:', error);
    return res.status(500).json({ error: 'Unable to create account right now' });
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password' });

  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password))) {
      return res.status(401).json({ error: 'Email or password is incorrect' });
    }
    res.cookie('token', issueSession(user.id), { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ error: 'Unable to sign in right now' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('token', cookieOptions());
  return res.json({ success: true });
});

app.get('/api/auth/me', authenticate, async (_req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: res.locals.userId } });
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Session lookup failed:', error);
    return res.status(500).json({ error: 'Unable to load account right now' });
  }
});

app.post('/api/capybara/feed', authenticate, async (_req, res) => {
  try {
    const user = await prisma.$transaction(async (transaction) => {
      const current = await transaction.user.findUnique({ where: { id: res.locals.userId } });
      if (!current || current.carrots < 1) return null;

      const reachedNextLevel = current.happiness + 10 >= 100;
      const updated = await transaction.user.update({
        where: { id: current.id },
        data: {
          carrots: { decrement: 1 },
          happiness: reachedNextLevel ? 0 : { increment: 10 },
          ...(reachedNextLevel ? { level: { increment: 1 } } : {}),
        },
      });
      await transaction.capybaraState.upsert({
        where: { userId: current.id },
        create: { userId: current.id, carrots: updated.carrots, happiness: updated.happiness, level: updated.level },
        update: {
          carrots: { decrement: 1 },
          happiness: reachedNextLevel ? 0 : { increment: 10 },
          ...(reachedNextLevel ? { level: { increment: 1 } } : {}),
        },
      });
      return updated;
    });
    if (!user) return res.status(400).json({ error: 'Not enough carrots' });
    return res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    console.error('Capybara feed failed:', error);
    return res.status(500).json({ error: 'Unable to feed your capybara right now' });
  }
});

app.get('/api/conversations', authenticate, async (_req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: res.locals.userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true, _count: { select: { messages: true } } },
    });
    return res.json({ conversations });
  } catch (error) {
    console.error('Conversation lookup failed:', error);
    return res.status(500).json({ error: 'Unable to load your conversations right now' });
  }
});

app.post('/api/conversations', authenticate, async (req, res) => {
  const parsed = conversationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a chat title up to 100 characters' });

  try {
    const conversation = await prisma.conversation.create({
      data: { title: parsed.data.title, userId: res.locals.userId },
    });
    return res.status(201).json({ conversation });
  } catch (error) {
    console.error('Conversation creation failed:', error);
    return res.status(500).json({ error: 'Unable to start a new chat right now' });
  }
});

app.patch('/api/conversations/:id', authenticate, async (req, res) => {
  const parsed = conversationSchema.safeParse(req.body);
  const conversationId = req.params.id;
  if (!parsed.success) return res.status(400).json({ error: 'Enter a chat title up to 100 characters' });
  if (!conversationId) return res.status(404).json({ error: 'Conversation not found' });

  try {
    const updated = await prisma.conversation.updateMany({
      where: { id: conversationId, userId: res.locals.userId },
      data: { title: parsed.data.title },
    });
    if (updated.count === 0) return res.status(404).json({ error: 'Conversation not found' });
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    return res.json({ conversation });
  } catch (error) {
    console.error('Conversation rename failed:', error);
    return res.status(500).json({ error: 'Unable to rename this conversation right now' });
  }
});

app.delete('/api/conversations/:id', authenticate, async (req, res) => {
  const conversationId = req.params.id;
  if (!conversationId) return res.status(404).json({ error: 'Conversation not found' });

  try {
    const deleted = await prisma.conversation.deleteMany({ where: { id: conversationId, userId: res.locals.userId } });
    if (deleted.count === 0) return res.status(404).json({ error: 'Conversation not found' });
    return res.json({ success: true });
  } catch (error) {
    console.error('Conversation deletion failed:', error);
    return res.status(500).json({ error: 'Unable to delete this conversation right now' });
  }
});

app.get('/api/conversations/:id/messages', authenticate, async (req, res) => {
  const conversationId = req.params.id;
  if (!conversationId) return res.status(404).json({ error: 'Conversation not found' });

  try {
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, userId: res.locals.userId } });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    const messages = await prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } });
    return res.json({ messages });
  } catch (error) {
    console.error('Message lookup failed:', error);
    return res.status(500).json({ error: 'Unable to load this conversation right now' });
  }
});

app.get('/api/documents', authenticate, async (_req, res) => {
  try {
    const documents = await prisma.document.findMany({
      where: { userId: res.locals.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, createdAt: true },
    });
    return res.json({ documents });
  } catch (error) {
    console.error('Document lookup failed:', error);
    return res.status(500).json({ error: 'Unable to load your documents right now' });
  }
});

app.post('/api/documents', authenticate, (req, res, next) => {
  documentUpload.single('file')(req, res, async (uploadError) => {
    if (uploadError) return next(uploadError);
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Choose a PDF, TXT, or MD file to upload' });

    const extension = path.extname(file.originalname).toLowerCase();
    const isPdf = extension === '.pdf' && file.mimetype === 'application/pdf';
    const isText = ['.txt', '.md'].includes(extension) && ['text/plain', 'text/markdown', 'application/octet-stream'].includes(file.mimetype);
    if (!isPdf && !isText) return res.status(415).json({ error: 'Only PDF, TXT, and MD files are supported' });

    try {
      const extracted = isPdf ? await pdfParse(file.buffer) : { text: file.buffer.toString('utf8') };
      const content = extracted.text.replace(/\u0000/g, '').trim();
      if (!content) return res.status(400).json({ error: 'No readable text was found in this file' });
      if (content.length > 500000) return res.status(413).json({ error: 'Extracted text is too long to study in one document' });
      const document = await prisma.document.create({
        data: { title: path.basename(file.originalname, extension).slice(0, 180), content, userId: res.locals.userId },
        select: { id: true, title: true, createdAt: true },
      });
      return res.status(201).json({ document, extractedCharacters: content.length });
    } catch (error) {
      console.error('Document parsing failed:', error);
      return res.status(400).json({ error: 'This file could not be read. Check that it is a valid text or PDF document.' });
    }
  });
});

app.post('/api/documents/:id/ask', authenticate, studyLimiter, async (req, res) => {
  const parsed = documentAskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a question, mode, and difficulty' });
  const documentId = req.params.id;
  if (!documentId) return res.status(404).json({ error: 'Document not found' });

  try {
    const document = await prisma.document.findFirst({ where: { id: documentId, userId: res.locals.userId } });
    if (!document) return res.status(404).json({ error: 'Document not found' });

    const conversation = await prisma.conversation.create({
      data: { title: `${document.title}: ${parsed.data.mode}`.slice(0, 100), userId: res.locals.userId },
    });
    const userMessage = await prisma.message.create({
      data: { content: parsed.data.question, role: 'user', conversationId: conversation.id },
    });
    const result = await generateStudyContent(parsed.data.question, parsed.data.mode, parsed.data.difficulty, {
      context: document.content.slice(0, 12000),
    });
    const assistantMessage = await prisma.message.create({
      data: { content: typeof result === 'string' ? result : JSON.stringify(result), role: 'assistant', conversationId: conversation.id },
    });
    if (parsed.data.mode === 'notes' && typeof result === 'string') {
      await prisma.note.create({
        data: {
          title: document.title,
          content: result,
          user: { connect: { id: res.locals.userId } },
          conversation: { connect: { id: conversation.id } },
        },
      });
    } else if (parsed.data.mode === 'quiz') {
      await prisma.quiz.create({
        data: {
          title: document.title,
          questions: JSON.stringify(result) as Prisma.InputJsonValue,
          user: { connect: { id: res.locals.userId } },
          conversation: { connect: { id: conversation.id } },
        },
      });
    } else if (parsed.data.mode === 'plan' && typeof result === 'string') {
      await prisma.studyPlan.create({
        data: {
          title: document.title,
          content: result,
          user: { connect: { id: res.locals.userId } },
          conversation: { connect: { id: conversation.id } },
        },
      });
    }
    await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    return res.json({ result, conversationId: conversation.id, messages: [userMessage, assistantMessage] });
  } catch (error) {
    console.error('Document study failed:', error);
    if (error instanceof Error && (error.message.includes('GEMINI_API_KEY is not configured') || error.message.includes('OPENAI_API_KEY is not configured'))) {
      return res.status(503).json({ error: 'AI service is not configured. Add GEMINI_API_KEY or OPENAI_API_KEY to the server environment.' });
    }
    if (hasExhaustedAiCredits(error)) {
      return res.status(503).json({ error: 'AI provider credits are exhausted. Add API credits or configure a Gemini key with available quota.' });
    }
    if (isAiTemporarilyUnavailable(error)) {
      return res.status(503).json({ error: 'Gemini is temporarily busy. Please try again in a moment.' });
    }
    return res.status(502).json({ error: 'Document study could not be generated. Please try again.' });
  }
});

app.post('/api/conversations/:id/messages', authenticate, async (req, res) => {
  const conversationId = req.params.id;
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid message' });
  if (!conversationId) return res.status(404).json({ error: 'Conversation not found' });

  try {
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, userId: res.locals.userId } });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    const message = await prisma.message.create({
      data: { content: parsed.data.content, role: parsed.data.role, conversationId },
    });
    await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    return res.status(201).json({ message });
  } catch (error) {
    console.error('Message creation failed:', error);
    return res.status(500).json({ error: 'Unable to save this message right now' });
  }
});

app.post('/api/study', authenticate, studyLimiter, async (req, res) => {
  const parsed = studySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a topic, mode, and difficulty' });

  try {
    let conversation = parsed.data.conversationId
      ? await prisma.conversation.findFirst({ where: { id: parsed.data.conversationId, userId: res.locals.userId } })
      : null;
    if (parsed.data.conversationId && !conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { title: parsed.data.topic.slice(0, 80), userId: res.locals.userId },
      });
    }

    const userMessage = await prisma.message.create({
      data: { content: parsed.data.topic, role: 'user', conversationId: conversation.id },
    });
    let documentContext: string | undefined;
    let title = parsed.data.topic.slice(0, 120);
    if (parsed.data.documentId) {
      const document = await prisma.document.findFirst({ where: { id: parsed.data.documentId, userId: res.locals.userId } });
      if (!document) return res.status(404).json({ error: 'Document not found' });
      documentContext = document.content.slice(0, 12000);
      title = document.title;
    }
    const result = await generateStudyContent(parsed.data.topic, parsed.data.mode, parsed.data.difficulty, {
      ...parsed.data.extraParams,
      ...(documentContext ? { context: documentContext } : {}),
    });
    const assistantMessage = await prisma.message.create({
      data: {
        content: typeof result === 'string' ? result : JSON.stringify(result),
        role: 'assistant',
        conversationId: conversation.id,
      },
    });
    if (parsed.data.mode === 'notes' && typeof result === 'string') {
      await prisma.note.create({
        data: {
          title,
          content: result,
          user: { connect: { id: res.locals.userId } },
          conversation: { connect: { id: conversation.id } },
        },
      });
    } else if (parsed.data.mode === 'quiz') {
      await prisma.quiz.create({
        data: {
          title,
          questions: JSON.stringify(result) as Prisma.InputJsonValue,
          user: { connect: { id: res.locals.userId } },
          conversation: { connect: { id: conversation.id } },
        },
      });
    } else if (parsed.data.mode === 'plan' && typeof result === 'string') {
      await prisma.studyPlan.create({
        data: {
          title,
          content: result,
          user: { connect: { id: res.locals.userId } },
          conversation: { connect: { id: conversation.id } },
        },
      });
    }
    await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    return res.json({ result, conversationId: conversation.id, messages: [userMessage, assistantMessage] });
  } catch (error) {
    console.error('Study route failed:', error);
    if (error instanceof Error && (error.message.includes('GEMINI_API_KEY is not configured') || error.message.includes('OPENAI_API_KEY is not configured'))) {
      return res.status(503).json({ error: 'AI service is not configured. Add GEMINI_API_KEY or OPENAI_API_KEY to the server environment.' });
    }
    if (hasExhaustedAiCredits(error)) {
      return res.status(503).json({ error: 'AI provider credits are exhausted. Add API credits or configure a Gemini key with available quota.' });
    }
    if (isAiTemporarilyUnavailable(error)) {
      return res.status(503).json({ error: 'Gemini is temporarily busy. Please try again in a moment.' });
    }
    return res.status(502).json({ error: 'Study content could not be generated. Please try again.' });
  }
});

app.get('/api/library', authenticate, async (_req, res) => {
  try {
    const userId = res.locals.userId;
    const [notes, quizzes, studyPlans] = await Promise.all([
      prisma.note.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.quiz.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.studyPlan.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return res.json({ notes, quizzes, studyPlans });
  } catch (error) {
    console.error('Library lookup failed:', error);
    return res.status(500).json({ error: 'Unable to load your library right now' });
  }
});

app.post('/api/capybara/update-carrots', authenticate, async (req, res) => {
  const parsed = carrotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Carrot reward must be a positive whole number' });

  try {
    const user = await prisma.$transaction(async (transaction) => {
      return rewardCarrots(transaction, res.locals.userId, parsed.data.amount);
    });
    return res.json({ success: true, carrots: user.carrots });
  } catch (error) {
    console.error('Carrot reward failed:', error);
    return res.status(500).json({ error: 'Unable to update carrot balance right now' });
  }
});

app.get('/api/tasks', authenticate, async (_req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { userId: res.locals.userId },
      orderBy: [{ completed: 'asc' }, { createdAt: 'desc' }],
    });
    return res.json({ tasks });
  } catch (error) {
    console.error('Task lookup failed:', error);
    return res.status(500).json({ error: 'Unable to load tasks right now' });
  }
});

app.post('/api/tasks', authenticate, async (req, res) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a task name up to 160 characters' });

  try {
    const task = await prisma.task.create({
      data: { title: parsed.data.title, userId: res.locals.userId },
    });
    return res.status(201).json({ task });
  } catch (error) {
    console.error('Task creation failed:', error);
    return res.status(500).json({ error: 'Unable to add this task right now' });
  }
});

app.patch('/api/tasks/:id', authenticate, async (req, res) => {
  const parsed = taskUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid task update' });
  const taskId = req.params.id;
  if (!taskId) return res.status(404).json({ error: 'Task not found' });

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.task.findFirst({ where: { id: taskId, userId: res.locals.userId } });
      if (!current) return null;

      const updated = await transaction.task.updateMany({
        where: { id: current.id, userId: res.locals.userId, completed: current.completed },
        data: { completed: parsed.data.completed, completedAt: parsed.data.completed ? new Date() : null },
      });
      let carrots: number | null = null;
      if (updated.count === 1 && parsed.data.completed && !current.completed) {
        const user = await rewardCarrots(transaction, res.locals.userId, 1);
        carrots = user.carrots;
      }
      const task = await transaction.task.findUnique({ where: { id: current.id } });
      return { task, carrotAwarded: carrots !== null, carrots };
    });
    if (!result) return res.status(404).json({ error: 'Task not found' });
    return res.json(result);
  } catch (error) {
    console.error('Task update failed:', error);
    return res.status(500).json({ error: 'Unable to update this task right now' });
  }
});

app.delete('/api/tasks/:id', authenticate, async (req, res) => {
  const taskId = req.params.id;
  if (!taskId) return res.status(404).json({ error: 'Task not found' });

  try {
    const deleted = await prisma.task.deleteMany({ where: { id: taskId, userId: res.locals.userId } });
    if (deleted.count === 0) return res.status(404).json({ error: 'Task not found' });
    return res.json({ success: true });
  } catch (error) {
    console.error('Task deletion failed:', error);
    return res.status(500).json({ error: 'Unable to delete this task right now' });
  }
});

app.post('/api/sessions/complete', authenticate, async (req, res) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid completed session duration' });

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({ where: { id: res.locals.userId } });
      if (!user) return null;

      const now = new Date();
      const lastDate = user.lastSessionAt?.toISOString().slice(0, 10);
      const today = now.toISOString().slice(0, 10);
      const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const newDay = lastDate !== today;
      const streak = newDay ? (lastDate === yesterdayDate ? user.streak + 1 : 1) : user.streak;
      const streakBonus = newDay && streak > 1 ? Math.min(streak - 1, 7) : 0;
      const carrotAwarded = 3 + streakBonus;

      const session = await transaction.studySession.create({
        data: { duration: parsed.data.duration, goal: parsed.data.goal || null, userId: user.id },
      });
      const updatedUser = await transaction.user.update({
        where: { id: user.id },
        data: { streak, lastSessionAt: now },
      });
      const rewardedUser = await rewardCarrots(transaction, user.id, carrotAwarded);
      return { session, carrots: rewardedUser.carrots, carrotsAwarded: carrotAwarded, streak: updatedUser.streak };
    });
    if (!result) return res.status(401).json({ error: 'Not authenticated' });
    return res.status(201).json(result);
  } catch (error) {
    console.error('Session completion failed:', error);
    return res.status(500).json({ error: 'Unable to save this session right now' });
  }
});

app.get('/api/capybara', authenticate, async (_req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: res.locals.userId },
      include: { capybaraState: true },
    });
    if (!user) return res.status(404).json({ error: 'Account not found' });

    const state = user.capybaraState ?? await prisma.capybaraState.create({
      data: {
        userId: user.id,
        carrots: user.carrots,
        happiness: user.happiness,
        level: user.level,
        streak: user.streak,
      },
    });
    return res.json({ capybara: state });
  } catch (error) {
    console.error('Capybara state lookup failed:', error);
    return res.status(500).json({ error: 'Unable to load capybara state right now' });
  }
});

export default app;

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
