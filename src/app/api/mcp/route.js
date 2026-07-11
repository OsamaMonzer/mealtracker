import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TOOLS = [
  {
    name: 'log_food',
    description: 'THE PREFERRED WAY to log any food. Automatically searches the database first, adds the ingredient if not found, then logs it. Always use this instead of quick_add_calories when the user mentions a real food. Provide weight_g in grams (e.g. 4 eggs = 240g). If the food is not in the DB, also provide calories_100g, protein_100g, carbs_100g, fat_100g using your knowledge.',
    inputSchema: {
      type: 'object',
      required: ['name', 'weight_g'],
      properties: {
        name:          { type: 'string', description: 'Food name e.g. "eggs", "chicken breast", "oats"' },
        weight_g:      { type: 'number', description: 'Total weight in grams to log' },
        meal_type:     { type: 'string', enum: ['Breakfast','Lunch','Dinner','Snack'] },
        date:          { type: 'string', description: 'Date YYYY-MM-DD. Defaults to today.' },
        calories_100g: { type: 'number', description: 'Required if ingredient is not in DB' },
        protein_100g:  { type: 'number' },
        carbs_100g:    { type: 'number' },
        fat_100g:      { type: 'number' },
      },
    },
  },
  {
    name: 'get_today_summary',
    description: "Get today's calories eaten, remaining macros vs goals, weekly average, and full meal list.",
    inputSchema: { type: 'object', properties: { date: { type: 'string', description: 'Date YYYY-MM-DD. Defaults to today.' } } },
  },
  {
    name: 'get_history',
    description: 'Get all meals and macros logged for a specific date.',
    inputSchema: { type: 'object', properties: { date: { type: 'string', description: 'Date YYYY-MM-DD. Defaults to today.' } } },
  },
  {
    name: 'get_weekly_stats',
    description: 'Get calorie and macro breakdown and averages for the last 7 days.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_ingredients',
    description: 'List all ingredients in the database with nutrition per 100g.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_recipes',
    description: 'List all saved recipes with ingredients and macros per portion.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'search_ingredient',
    description: 'Search for an ingredient by name in the local database.',
    inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' } } },
  },
  {
    name: 'log_meal',
    description: 'Log eating a recipe by its ID. Use list_recipes to find the recipe_id first.',
    inputSchema: {
      type: 'object',
      required: ['recipe_id', 'portions_eaten'],
      properties: {
        recipe_id: { type: 'integer' }, portions_eaten: { type: 'number' },
        meal_type: { type: 'string', enum: ['Breakfast','Lunch','Dinner','Snack'] }, date: { type: 'string' },
      },
    },
  },
  {
    name: 'log_ingredient',
    description: 'Log eating an ingredient by weight in grams. Use list_ingredients to find ingredient_id.',
    inputSchema: {
      type: 'object',
      required: ['ingredient_id', 'weight_g'],
      properties: {
        ingredient_id: { type: 'integer' }, weight_g: { type: 'number' },
        meal_type: { type: 'string', enum: ['Breakfast','Lunch','Dinner','Snack'] }, date: { type: 'string' },
      },
    },
  },
  {
    name: 'quick_add_calories',
    description: 'Log calories with just a name and calorie number. Only use this when the user provides ONLY a calorie count and no real food name. Never use for real foods like eggs, chicken, rice, etc.',
    inputSchema: {
      type: 'object', required: ['name', 'calories'],
      properties: { name: { type: 'string' }, calories: { type: 'number' }, meal_type: { type: 'string', enum: ['Breakfast','Lunch','Dinner','Snack'] }, date: { type: 'string' } },
    },
  },
  {
    name: 'create_recipe',
    description: 'Create a new recipe with a list of ingredients and weights.',
    inputSchema: {
      type: 'object', required: ['name', 'portions', 'ingredients'],
      properties: {
        name: { type: 'string' }, portions: { type: 'number' },
        ingredients: { type: 'array', items: { type: 'object', required: ['ingredient_id','weight_g'], properties: { ingredient_id: { type: 'integer' }, weight_g: { type: 'number' } } } },
      },
    },
  },
  {
    name: 'add_ingredient',
    description: 'Add a new ingredient to the database with nutrition per 100g.',
    inputSchema: {
      type: 'object', required: ['name', 'calories_100g'],
      properties: {
        name: { type: 'string' }, calories_100g: { type: 'number' }, protein_100g: { type: 'number' },
        carbs_100g: { type: 'number' }, fat_100g: { type: 'number' },
        category: { type: 'string', enum: ['Protein','Carb','Fat','Vegetable','Fruit','Sauce','Dairy','Other'] },
        brand: { type: 'string' }, serving_label: { type: 'string' }, serving_grams: { type: 'number' },
      },
    },
  },
  {
    name: 'scan_barcode',
    description: 'Look up a product barcode on OpenFoodFacts and save it to the ingredient database.',
    inputSchema: { type: 'object', required: ['barcode'], properties: { barcode: { type: 'string' } } },
  },
  {
    name: 'get_goals',
    description: 'Get the current daily nutrition goals.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'update_goals',
    description: 'Update one or more daily nutrition goals.',
    inputSchema: {
      type: 'object',
      properties: { calorie_goal: { type: 'number' }, protein_goal: { type: 'number' }, carbs_goal: { type: 'number' }, fat_goal: { type: 'number' }, weight_target: { type: 'number' } },
    },
  },
  {
    name: 'delete_log_entry',
    description: 'Delete a meal log entry by ID. Use get_history to find the log ID first.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
  },
];

async function callTool(toolName, args, origin) {
  const res = await fetch(`${origin}/api/gpt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.MEALTRACKER_API_KEY || 'mealtracker-shortcut-2024' },
    body: JSON.stringify({ action: toolName, ...args }),
  });
  return res.json();
}

function sseEvent(data) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function getOrigin(request) {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host');
  return `${proto}://${host}`;
}

async function handleMcpMessage(body, origin) {
  const { jsonrpc, method, params, id } = body;

  if (jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid JSON-RPC version' } };
  }

  if (method === 'initialize') {
    return { jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'mealtracker', version: '1.0.0' } } };
  }

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};
    const tool = TOOLS.find(t => t.name === toolName);
    if (!tool) return { jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${toolName}` } };
    const result = await callTool(toolName, args, origin);
    return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } };
  }

  if (method === 'notifications/initialized') return null; // no response needed

  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
}

// ── GET: SSE transport (Perplexity, Claude Desktop SSE mode) ──────────────────
// Perplexity opens a GET /api/mcp SSE stream, then POSTs messages to the same URL.
// We keep the stream alive and respond to pings.
export async function GET(request) {
  const accept = request.headers.get('accept') || '';

  // If client wants SSE, open the stream
  if (accept.includes('text/event-stream')) {
    const stream = new ReadableStream({
      start(controller) {
        // Send initial endpoint event so client knows where to POST
        const origin = getOrigin(request);
        controller.enqueue(
          new TextEncoder().encode(
            `event: endpoint\ndata: ${origin}/api/mcp\n\n`
          )
        );
        // Keep alive every 20s
        const ping = setInterval(() => {
          try { controller.enqueue(new TextEncoder().encode(': ping\n\n')); }
          catch { clearInterval(ping); }
        }, 20000);
        // Clean up if client disconnects
        request.signal?.addEventListener('abort', () => {
          clearInterval(ping);
          try { controller.close(); } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  // Plain GET health check
  return NextResponse.json({ ok: true, name: 'mealtracker-mcp', version: '1.0.0' });
}

// ── POST: Streamable HTTP transport (ChatGPT, Cursor) ─────────────────────────
export async function POST(request) {
  try {
    const origin = getOrigin(request);
    const contentType = request.headers.get('content-type') || '';
    const accept = request.headers.get('accept') || '';

    const body = await request.json();

    // If client wants SSE response (some MCP clients send POST + accept: text/event-stream)
    if (accept.includes('text/event-stream')) {
      const response = await handleMcpMessage(body, origin);
      const stream = new ReadableStream({
        start(controller) {
          if (response) {
            controller.enqueue(new TextEncoder().encode(sseEvent(response)));
          }
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    }

    // Standard JSON response (ChatGPT, Streamable HTTP)
    const response = await handleMcpMessage(body, origin);
    if (response === null) return new NextResponse(null, { status: 204 });
    return NextResponse.json(response);

  } catch (e) {
    console.error('MCP error', e);
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: e.message } }, { status: 500 });
  }
}
