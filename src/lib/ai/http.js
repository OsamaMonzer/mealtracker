import { NextResponse } from 'next/server';
import { createClient } from '../../utils/supabase/server';
import { runAction, ActionError } from './actions';

// Auth context for AI endpoints: API-key callers (via middleware) or a logged-in browser session.
export async function getContext() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export function errorBody(e) {
  if (e instanceof ActionError) return { status: e.status, body: { error: e.message, ...e.extra } };
  console.error('AI action error', e);
  return { status: 500, body: { error: e?.message || 'Internal error' } };
}

// Runs one action and returns a JSON response (used by the GPT endpoints).
export async function actionResponse(name, params) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await runAction(ctx, name, params));
  } catch (e) {
    const { status, body } = errorBody(e);
    return NextResponse.json(body, { status });
  }
}
