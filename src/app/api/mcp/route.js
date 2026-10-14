import { NextResponse } from 'next/server';
import { TOOLS, SERVER_INSTRUCTIONS } from '../../../lib/ai/tools';
import { runAction, hasAction } from '../../../lib/ai/actions';
import { getContext, errorBody } from '../../../lib/ai/http';

export const dynamic = 'force-dynamic';

// MCP server over Streamable HTTP (stateless, JSON responses).
// URL for clients:  https://<your-domain>/api/mcp
// Auth: header `Authorization: Bearer <MEALTRACKER_API_KEY>` (or `x-api-key`),
//       or `?key=<MEALTRACKER_API_KEY>` for clients that can't set headers.
// Middleware has already rejected requests without a valid key or session.

const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'meal-tracker', title: 'Meal Tracker', version: '2.0.0' };

const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });

async function handleMessage(msg, ctx) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg?.id, -32600, 'Invalid Request');
  }
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  if (method.startsWith('notifications/')) return null;
  if (isNotification) return null;

  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion;
      return rpcResult(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: SERVER_INSTRUCTIONS,
      });
    }
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS });
    case 'tools/call': {
      const name = params?.name;
      if (!name || !hasAction(name)) return rpcError(id, -32602, `Unknown tool: ${name}`);
      try {
        const result = await runAction(ctx, name, params?.arguments || {});
        return rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result });
      } catch (e) {
        // Tool errors go back to the model (isError) so it can correct itself.
        const { body } = errorBody(e);
        return rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }], isError: true });
      }
    }
    case 'resources/list':
      return rpcResult(id, { resources: [] });
    case 'prompts/list':
      return rpcResult(id, { prompts: [] });
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

function reply(payload, request) {
  const accept = request.headers.get('accept') || '';
  // Clients that only accept SSE get the response as a single SSE event.
  if (accept.includes('text/event-stream') && !accept.includes('application/json')) {
    return new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }
  return NextResponse.json(payload);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, 'Parse error'), { status: 400 });
  }

  const ctx = await getContext();
  if (!ctx) return NextResponse.json(rpcError(null, -32001, 'Unauthorized'), { status: 401 });

  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleMessage(m, ctx)))).filter(Boolean);
    return out.length ? reply(out, request) : new Response(null, { status: 202 });
  }

  const out = await handleMessage(body, ctx);
  return out ? reply(out, request) : new Response(null, { status: 202 });
}

// Stateless server: no server-initiated SSE stream.
export async function GET(request) {
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/event-stream')) {
    return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  }
  return NextResponse.json({ ok: true, name: SERVER_INFO.name, version: SERVER_INFO.version, tools: TOOLS.length, transport: 'streamable-http (POST)' });
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
