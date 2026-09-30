import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../backend/src';

export const config = { api: { bodyParser: false } };

export default function handler(request: VercelRequest, response: VercelResponse) {
  const rawPath = request.query.path;
  const route = Array.isArray(rawPath) ? rawPath.join('/') : rawPath ?? '';
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(request.query)) {
    if (key === 'path' || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }

  request.url = `/api/${route}${query.size ? `?${query.toString()}` : ''}`;
  return app(request, response);
}