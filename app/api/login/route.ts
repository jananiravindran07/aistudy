import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { withApiError, clientIp } from '@/lib/handler';
import { setSessionCookie, signSessionToken, toPublicUser, verifyPassword } from '@/lib/auth';
import { loginSchema, parseBody } from '@/lib/validation';
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
    const parsed = parseBody(loginSchema, body);
    if (!parsed.ok) {
      throw new AppError(400, parsed.message, { code: 'validation', retryable: false });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    // Deliberately identical message for "no such user" and "wrong password"
    // to avoid leaking which emails are registered.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppError(401, 'Invalid email or password.', {
        code: 'invalid_credentials',
        retryable: false,
      });
    }

    await setSessionCookie(signSessionToken(user.id));
    return Response.json({ user: toPublicUser(user) });
  });
}