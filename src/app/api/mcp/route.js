import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ── MCP-over-HTTP (SSE) transport ──────────────────────────────────────────────
//
// This implements the MCP Streamable HTTP transport (2025-03-26 spec).
// Compatible with Claude Desktop "Server URL" mode, Cursor, and other
// MCP clients that connect over HTTP rather than stdio.
//
// All tool logic lives in /api/gpt — we delegate every call there.
// Auth: x-api-key header (same key used everywhere)

const TOOLS = [
  {
    name: 'get_today_summary',
    description: "Get today's calories eaten, remaining macros vs goals, weekly average, and full meal list.",
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date YYYY-MM-DD. Defaults to today.' },
      },
    },
  },
  {
    name: 'get_history',
    description: 'Get all meals and macros logged for a specific date.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date YYYY-MM-DD. Defaults to today.' },
      },
    },
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
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Ingredient name to search for.' },
      },
    },
  },
  {
    name: 'log_meal',
    description: 'Log eating a recipe by its ID. Use list_recipes to find the recipe_id first.',
    inputSchema: {
      type: 'object',
      required: ['recipe_id', 'portions_eaten'],
      properties: {
        recipe_id:      { type: 'integer' },
        portions_eaten: { type: 'number' },
        meal_type:      { type: 'string', enum: ['Breakfast','Lunch','Dinner','Snack'] },
        date:           { type: 'string' },
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
        ingredient_id: { type: 'integer' },
        weight_g:      { type: 'number' },
        meal_type:     { type: 'string', enum: ['Breakfast','Lunch','Dinner','Snack'] },
        date:          { type: 'string' },
      },
    },
  },
  {
    name: 'quick_add_calories',
    description: 'Log calories with just a name and number. No ingredient needed.',
    inputSchema: {
      type: 'object',
      required: ['name', 'calories'],
      properties: {
        name:      { type: 'string' },
        calories:  { type: 'number' },
        meal_type: { type: 'string', enum: ['Breakfast','Lunch','Dinner','Snack'] },
        date:      { type: 'string' },
      },
    },
  },
  {
    name: 'create_recipe',
    description: 'Create a new recipe with a list of ingredients and weights.',
    inputSchema: {
      type: 'object',
      required: ['name', 'portions', 'ingredients'],
      properties: {
        name:     { type: 'string' },
        portions: { type: 'number' },
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            required: ['ingredient_id', 'weight_g'],
            properties: {
              ingredient_id: { type: 'integer' },
              weight_g:      { type: 'number' },
            },
          },
        },
      },
    },
  },
  {
    name: 'add_ingredient',
    description: 'Add a new ingredient to the database with nutrition per 100g.',
    inputSchema: {
      type: 'object',
      required: ['name', 'calories_100g'],
      properties: {
        name:          { type: 'string' },
        calories_100g: { type: 'number' },
        protein_100g:  { type: 'number' },
        carbs_100g:    { type: 'number' },
        fat_100g:      { type: 'number' },
        category:      { type: 'string', enum: ['Protein','Carb','Fat','Vegetable','Fruit','Sauce','Dairy','Other'] },
        brand:         { type: 'string' },
        serving_label: { type: 'string' },
        serving_grams: { type: 'number' },
      },
    },
  },
  {
    name: 'scan_barcode',
    description: 'Look up a product barcode on OpenFoodFacts and save it to the ingredient database.',
    inputSchema: {
      type: 'object',
      required: ['barcode'],
      properties: {
        barcode: { type: 'string' },
      },
    },
  },
  {
    name: 'get_goals',
    description: 'Get the current daily nutrition goals (calories, protein, carbs, fat, weight target).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'update_goals',
    description: 'Update one or more daily nutrition goals.',
    inputSchema: {
      type: 'object',
      properties: {
        calorie_goal:  { type: 'number' },
        protein_goal:  { type: 'number' },
        carbs_goal:    { type: 'number' },
        fat_goal:      { type: 'number' },
        weight_target: { type: 'number' },
      },
    },
  },
  {
    name: 'delete_log_entry',
    description: 'Delete a meal log entry by ID. Use get_history to find the log ID first.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'integer' },
      },
    },
  },
];

// Delegate tool calls to /api/gpt
async function callTool(toolName, args, origin) {
  const res = await fetch(`${origin}/api/gpt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.MEALTRACKER_API_KEY || 'mealtracker-shortcut-2024',
    },
    body: JSON.stringify({ action: toolName, ...args }),
  });
  return res.json();
}

function mcpResponse(id, result) {
  return NextResponse.json({
    jsonrpc: '2.0',
    id,
    result,
  });
}

function mcpError(id, code, message) {
  return NextResponse.json({
    jsonrpc: '2.0',
    id,
    error: { code, message },
  });
}

export async function GET() {
  // Health check — confirms the MCP endpoint is reachable
  return NextResponse.json({ ok: true, name: 'mealtracker-mcp', version: '1.0.0' });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { jsonrpc, method, params, id } = body;

    if (jsonrpc !== '2.0') {
      return mcpError(id, -32600, 'Invalid JSON-RPC version');
    }

    // ── initialize ────────────────────────────────────────────────────────────
    if (method === 'initialize') {
      return mcpResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'mealtracker', version: '1.0.0' },
      });
    }

    // ── tools/list ──────────────────────────────────────────────────────────
    if (method === 'tools/list') {
      return mcpResponse(id, { tools: TOOLS });
    }

    // ── tools/call ──────────────────────────────────────────────────────────
    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};
      const tool = TOOLS.find(t => t.name === toolName);
      if (!tool) return mcpError(id, -32602, `Unknown tool: ${toolName}`);

      const origin = request.headers.get('x-forwarded-proto')
        ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('host')}`
        : `http://${request.headers.get('host')}`;

      const result = await callTool(toolName, args, origin);
      return mcpResponse(id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      });
    }

    // ── notifications/initialized (no response needed) ─────────────────────
    if (method === 'notifications/initialized') {
      return new NextResponse(null, { status: 204 });
    }

    return mcpError(id, -32601, `Method not found: ${method}`);

  } catch (e) {
    console.error('MCP SSE error', e);
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: e.message } }, { status: 500 });
  }
}
