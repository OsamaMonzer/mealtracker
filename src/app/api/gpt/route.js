import { actionResponse } from '../../../lib/ai/http';

export const dynamic = 'force-dynamic';

// Legacy single endpoint: POST { "action": "<tool name>", ...params }.
// New custom GPTs should use /api/actions/<tool name> (see /openapi.json).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { action, ...params } = body || {};
  return actionResponse(action, params);
}
