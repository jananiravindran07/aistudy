import { withApiError } from '@/lib/handler';
import { clearSessionCookie } from '@/lib/auth';

export async function POST() {
  return withApiError(async () => {
    await clearSessionCookie();
    return Response.json({ ok: true });
  });
}