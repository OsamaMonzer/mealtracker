import { actionResponse } from '../../../../lib/ai/http';

export const dynamic = 'force-dynamic';

// One endpoint per tool for custom GPT actions: POST /api/actions/log_food { ...params }
export async function POST(request, { params }) {
  const body = await request.json().catch(() => ({}));
  return actionResponse(params.action, body || {});
}
