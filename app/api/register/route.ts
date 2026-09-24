import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { withApiError, clientIp } from '@/lib/handler';
import { hashPassword, setSessionCookie, signSessionToken, toPublicUser } from '@/lib/auth';
import { parseBody, registerSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  return withApiError(async () => {
    const rl = rateLimit(`auth:${clientIp(request)}`, 15, 60_000);
    if (!rl.allowed) {
      throw new AppError(429, 'Too many attempts. Please wait a moment and try again.', {
        code: 'rate_limited',
        retryable: true,
      });
    }

    const body = await request.json().catch(() => null);
    const parsed = parseBody(registerSchema, body);
    if (!parsed.ok) {
      throw new AppError(400, parsed.message, { code: 'validation', retryable: false });
    }
    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'An account with this email already exists. Try signing in instead.', {
        code: 'email_taken',
        retryable: false,
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { name, email, passwordHash } });

    await setSessionCookie(signSessionToken(user.id));
    return Response.json({ user: toPublicUser(user) });
  });
}