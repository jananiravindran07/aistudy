import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import type { PublicUser } from '@/lib/types';

export const SESSION_COOKIE = 'session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds)

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError(500, 'JWT_SECRET is not configured on the server.');
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSessionToken(userId: string): string {
  return jwt.sign({ sub: userId }, getSecret(), { expiresIn: SESSION_MAX_AGE });
}

/** Attach the session cookie to the outgoing response via the request cookie store. */
export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  store.delete(SESSION_COOKIE);
}

export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}): PublicUser {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt.toISOString() };
}

/** Resolve the signed-in user (if any) from the session cookie. Returns null when anonymous. */
export async function getAuthUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getSecret()) as { sub?: string };
    if (!payload.sub) return null;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    return user ?? null;
  } catch {
    return null;
  }
}

/** Like getAuthUser but throws 401 when there is no valid session. */
export async function requireUser() {
  const user = await getAuthUser();
  if (!user) {
    throw new AppError(401, 'You need to sign in to do that.', {
      code: 'unauthorized',
      retryable: false,
    });
  }
  return user;
}