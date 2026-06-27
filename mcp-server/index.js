import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ─── Config ────────────────────────────────────────────────────────────────────
// Set these via environment variables or edit the defaults below.
const BASE_URL = process.env.MEALTRACKER_URL || 'http://localhost:3000';
const API_KEY  = process.env.MEALTRACKER_API_KEY || 'mealtracker-shortcut-2024';

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };
}

async function api(method, path, body) {
  const url = BASE_URL + path;
  const res = await fetch(url, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { raw: text }; }
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function fmt(obj) {
  return JSON.stringify(obj, null, 2);
}

// ─── Server ────────────────────────────────────────────────────────────────────
const server = new McpServer({
  name: 'mealtracker',
  version: '1.0.0',
});

// ── 1. Get today's summary ──────────────────────────────────────────────────
server.tool(
  'get_today_summary',
  'Get today\'s calories, protein, carbs, fat eaten so far plus weekly average and current weight.',
  {},
  async () => {
    const data = await api('GET', '/api/dashboard');
    const goals = await api('GET', '/api/goals');
    const history = await api('GET', `/api/history?date=${today()}`);
    return {
      content: [{
        type: 'text',
        text: fmt({
          date: today(),
          today_eaten: data.todayMacros,
          goals: {
            calories: goals.calorie_goal,
            protein:  goals.protein_goal,
            carbs:    goals.carbs_goal,
            fat:      goals.fat_goal,
          },
          remaining: {
            calories: Math.max(0, goals.calorie_goal - data.todayMacros.cals),
            protein:  Math.max(0, goals.protein_goal  - data.todayMacros.p),
            carbs:    Math.max(0, goals.carbs_goal     - data.todayMacros.c),
            fat:      Math.max(0, goals.fat_goal       - data.todayMacros.f),
          },
          weekly_avg_calories: data.weeklyAvgCals,
          current_weight_kg: data.currentWeight,
          meals_today: history.logs || [],
        }),
      }],
    };
  }
);

// ── 2. Get history for a specific date ────────────────────────────────────
server.tool(
  'get_history',
  'Get all meals and macros logged for a specific date (YYYY-MM-DD). Defaults to today.',
  { date: z.string().optional().describe('Date in YYYY-MM-DD format. Defaults to today.') },
  async ({ date }) => {
    const d = date || today();
    const data = await api('GET', `/api/history?date=${d}`);
    return { content: [{ type: 'text', text: fmt(data) }] };
  }
);

// ── 3. Search ingredient ───────────────────────────────────────────────────
server.tool(
  'search_ingredient',
  'Search for an ingredient in the local DB and on OpenFoodFacts. Returns name, calories, protein, carbs, fat per 100g.',
  { query: z.string().describe('Ingredient name or barcode number to search for.') },
  async ({ query }) => {
    // First check local DB
    const local = await api('GET', `/api/ingredients/search-local?q=${encodeURIComponent(query)}`);
    // Also check OpenFoodFacts
    const isBarcode = /^\d{8,14}$/.test(query.trim());
    const extUrl = isBarcode
      ? `/api/ingredients/search?barcode=${encodeURIComponent(query)}`
      : `/api/ingredients/search?q=${encodeURIComponent(query)}`;
    const ext = await api('GET', extUrl);
    return {
      content: [{
        type: 'text',
        text: fmt({ local_results: local, external_results: ext }),
      }],
    };
  }
);

// ── 4. List all ingredients in DB ─────────────────────────────────────────
server.tool(
  'list_ingredients',
  'List all ingredients saved in the local database with their nutrition per 100g.',
  {},
  async () => {
    const data = await api('GET', '/api/ingredients');
    return { content: [{ type: 'text', text: fmt(data) }] };
  }
);

// ── 5. List all recipes ───────────────────────────────────────────────────
server.tool(
  'list_recipes',
  'List all saved recipes with their ingredients, macros per portion, and total macros.',
  {},
  async () => {
    const data = await api('GET', '/api/recipes');
    return { content: [{ type: 'text', text: fmt(data) }] };
  }
);

// ── 6. Log a meal (by recipe) ─────────────────────────────────────────────
server.tool(
  'log_meal',
  'Log eating a recipe. Use list_recipes first to find the recipe_id. Meal type: Breakfast, Lunch, Dinner, or Snack.',
  {
    recipe_id:     z.number().describe('ID of the recipe to log.'),
    portions_eaten: z.number().describe('Number of portions eaten. Use decimals e.g. 0.5 for half a portion.'),
    meal_type:     z.enum(['Breakfast','Lunch','Dinner','Snack']).optional().describe('Meal type. Defaults to Snack.'),
    date:          z.string().optional().describe('Date YYYY-MM-DD. Defaults to today.'),
  },
  async ({ recipe_id, portions_eaten, meal_type, date }) => {
    const data = await api('POST', '/api/daily', {
      recipe_id,
      portions_eaten,
      meal_type: meal_type || 'Snack',
      date: date || today(),
    });
    return { content: [{ type: 'text', text: fmt(data) }] };
  }
);

// ── 7. Log an ingredient by weight (no recipe needed) ─────────────────────
server.tool(
  'log_ingredient',
  'Log eating a specific ingredient by weight in grams. Use list_ingredients or search_ingredient first to find the ingredient_id.',
  {
    ingredient_id: z.number().describe('ID of the ingredient.'),
    weight_g:      z.number().describe('Weight eaten in grams.'),
    meal_type:     z.enum(['Breakfast','Lunch','Dinner','Snack']).optional(),
    date:          z.string().optional().describe('Date YYYY-MM-DD. Defaults to today.'),
  },
  async ({ ingredient_id, weight_g, meal_type, date }) => {
    const data = await api('POST', '/api/daily', {
      ingredient_id,
      weight_g,
      meal_type: meal_type || 'Snack',
      date: date || today(),
    });
    return { content: [{ type: 'text', text: fmt(data) }] };
  }
);

// ── 8. Quick-add calories (no ingredient needed) ──────────────────────────
server.tool(
  'quick_add_calories',
  'Quickly log calories with just a name and calorie amount. Use when you don\'t need full macro tracking.',
  {
    name:     z.string().describe('Display name for the entry e.g. "Coffee with milk".'),
    calories: z.number().describe('Calorie amount to log.'),
    meal_type: z.enum(['Breakfast','Lunch','Dinner','Snack']).optional(),
    date:     z.string().optional().describe('Date YYYY-MM-DD. Defaults to today.'),
  },
  async ({ name, calories, meal_type, date }) => {
    const data = await api('POST', '/api/daily', {
      recipe_id: 'QUICK_ADD',
      quick_add_name: name,
      quick_add_calories: calories,
      meal_type: meal_type || 'Snack',
      date: date || today(),
    });
    return { content: [{ type: 'text', text: fmt(data) }] };
  }
);

// ── 9. Create a recipe ────────────────────────────────────────────────────
server.tool(
  'create_recipe',
  'Create a new recipe with ingredients. Use search_ingredient or list_ingredients first to find ingredient IDs and confirm nutrition data.',
  {
    name:     z.string().describe('Recipe name.'),
    portions: z.number().describe('How many portions this recipe makes.'),
    ingredients: z.array(z.object({
      ingredient_id: z.number().describe('Ingredient ID from the database.'),
      weight_g:      z.number().describe('Weight of this ingredient in grams for the whole recipe.'),
    })).describe('List of ingredients with weights.'),
  },
  async ({ name, portions, ingredients }) => {
    const data = await api('POST', '/api/recipes', { name, portions, ingredients });
    return { content: [{ type: 'text', text: fmt(data) }] };
  }
);

// ── 10. Add ingredient to DB ──────────────────────────────────────────────
server.tool(
  'add_ingredient',
  'Add a new ingredient to the local database with nutrition per 100g.',
  {
    name:          z.string(),
    calories_100g: z.number(),
    protein_100g:  z.number(),
    carbs_100g:    z.number(),
    fat_100g:      z.number(),
    category:      z.enum(['Protein','Carb','Fat','Vegetable','Fruit','Sauce','Dairy','Other']).optional(),
    brand:         z.string().optional(),
    serving_label: z.string().optional().describe('e.g. "1 egg" or "1 slice"'),
    serving_grams: z.number().optional(),
  },
  async (args) => {
    const data = await api('POST', '/api/ingredients', {
      name:          args.name,
      calories_100g: args.calories_100g,
      protein_100g:  args.protein_100g,
      carbs_100g:    args.carbs_100g,
      fat_100g:      args.fat_100g,
      category:      args.category || 'Other',
      brand:         args.brand || '',
      status:        'Raw',
      serving_label: args.serving_label || null,
      serving_grams: args.serving_grams || null,
    });
    return { content: [{ type: 'text', text: fmt(data) }] };
  }
);

// ── 11. Scan barcode ──────────────────────────────────────────────────────
server.tool(
  'scan_barcode',
  'Look up a barcode on OpenFoodFacts and save it to the ingredient database if found.',
  { barcode: z.string().describe('Product barcode number (8–14 digits).') },
  async ({ barcode }) => {
    const data = await api('POST', '/api/shortcut/scan', { barcode });
    return { content: [{ type: 'text', text: fmt(data) }] };
  }
);

// ── 12. Get goals ─────────────────────────────────────────────────────────
server.tool(
  'get_goals',
  'Get the current daily nutrition goals (calories, protein, carbs, fat, weight target).',
  {},
  async () => {
    const data = await api('GET', '/api/goals');
    return { content: [{ type: 'text', text: fmt(data) }] };
  }
);

// ── 13. Update goals ──────────────────────────────────────────────────────
server.tool(
  'update_goals',
  'Update the daily nutrition goals.',
  {
    calorie_goal: z.number().optional(),
    protein_goal: z.number().optional(),
    carbs_goal:   z.number().optional(),
    fat_goal:     z.number().optional(),
    weight_target: z.number().optional(),
  },
  async (args) => {
    // Fetch current goals first so we only patch what was provided
    const current = await api('GET', '/api/goals');
    const data = await api('POST', '/api/goals', {
      calorie_goal:  args.calorie_goal  ?? current.calorie_goal,
      protein_goal:  args.protein_goal  ?? current.protein_goal,
      carbs_goal:    args.carbs_goal    ?? current.carbs_goal,
      fat_goal:      args.fat_goal      ?? current.fat_goal,
      weight_target: args.weight_target ?? current.weight_target,
    });
    return { content: [{ type: 'text', text: fmt(data) }] };
  }
);

// ── 14. Delete a daily log entry ──────────────────────────────────────────
server.tool(
  'delete_log_entry',
  'Delete a specific meal log entry by its ID. Use get_history to find the log ID first.',
  { id: z.number().describe('The log entry ID to delete.') },
  async ({ id }) => {
    const data = await api('DELETE', `/api/daily/${id}`);
    return { content: [{ type: 'text', text: fmt(data) }] };
  }
);

// ── 15. Get weekly stats ──────────────────────────────────────────────────
server.tool(
  'get_weekly_stats',
  'Get calorie and macro averages for the last 7 days.',
  {},
  async () => {
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const results = await Promise.all(
      dates.map(d => api('GET', `/api/history?date=${d}`))
    );

    const days = results.map((r, i) => ({
      date: dates[i],
      calories: r.totals?.cals ?? 0,
      protein:  r.totals?.p   ?? 0,
      carbs:    r.totals?.c   ?? 0,
      fat:      r.totals?.f   ?? 0,
      meals:    r.logs?.length ?? 0,
    }));

    const avg = (key) => Math.round(days.reduce((s, d) => s + d[key], 0) / days.length);

    return {
      content: [{
        type: 'text',
        text: fmt({
          days,
          averages: {
            calories: avg('calories'),
            protein:  avg('protein'),
            carbs:    avg('carbs'),
            fat:      avg('fat'),
          },
        }),
      }],
    };
  }
);

// ─── Start ─────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
