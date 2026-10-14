import { NextResponse } from 'next/server';
import { TOOLS } from '../../lib/ai/tools';

export const dynamic = 'force-dynamic';

// OpenAPI schema for a custom GPT, generated from the same tool list the MCP server uses.
// In the GPT editor: Actions → Import from URL → https://<your-domain>/openapi.json
// Authentication: API Key → Auth Type: Bearer → your MEALTRACKER_API_KEY.
export async function GET(request) {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host');

  const paths = {};
  for (const t of TOOLS) {
    paths[`/api/actions/${t.name}`] = {
      post: {
        operationId: t.name,
        summary: t.title,
        description: t.description.slice(0, 300),
        'x-openai-isConsequential': !!t.annotations?.destructiveHint, // don't ask before every food log
        requestBody: {
          required: true,
          content: { 'application/json': { schema: t.inputSchema } },
        },
        responses: {
          200: { description: 'Result', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
          default: { description: 'Error with an "error" message', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        },
      },
    };
  }

  return NextResponse.json({
    openapi: '3.1.0',
    info: {
      title: 'Meal Tracker',
      version: '2.0.0',
      description: "Log meals and read nutrition, goals and weight from the user's personal meal tracker.",
    },
    servers: [{ url: `${proto}://${host}` }],
    paths,
    components: {
      schemas: {},
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
    },
    security: [{ bearerAuth: [] }],
  });
}
