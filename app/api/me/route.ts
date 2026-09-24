import { withApiError } from '@/lib/handler';
import { requireUser, toPublicUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withApiError(async () => {
    const user = await requireUser();
    return Response.json(toPublicUser(user));
  });
}