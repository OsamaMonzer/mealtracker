// Tool catalogue for AI assistants (MCP clients and custom GPT actions).
// The descriptions are written for the model: they say WHEN to use each tool,
// not only what it does. Implementations live in ./actions.js.

const DATE = {
  type: 'string',
  description: "Date as YYYY-MM-DD, or 'today' / 'yesterday'. Defaults to today in the user's timezone.",
};
const MEAL = { type: 'string', enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'], description: 'Defaults to Snack.' };
const MACROS_100G = {
  calories_100g: { type: 'number', description: 'kcal per 100 g' },
  protein_100g: { type: 'number', description: 'g protein per 100 g' },
  carbs_100g: { type: 'number', description: 'g carbs per 100 g' },
  fat_100g: { type: 'number', description: 'g fat per 100 g' },
};

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

export const TOOLS = [
  // ── Start here ────────────────────────────────────────────────────────────
  {
    name: 'get_overview',
    title: 'Overview (start here)',
    description:
      "START HERE when a conversation begins or when unsure. Returns today's date and time zone, today's meals with log ids, totals vs goals and what's remaining, the latest weight, logging streak, and the user's most frequently eaten foods/recipes (with ids) for quick re-logging.",
    inputSchema: { type: 'object', properties: {} },
    annotations: READ,
  },

  // ── Logging food ──────────────────────────────────────────────────────────
  {
    name: 'log_food',
    title: 'Log a food by name',
    description:
      "PREFERRED way to log a single food the user ate (e.g. '200g chicken breast', '3 eggs'). Searches the user's ingredient list first. If the food isn't found, it returns ingredient_not_found with candidates — then either pick a candidate (log_ingredient) or call again WITH per-100g macros from your own knowledge to create it. Convert counts to grams yourself (1 large egg ≈ 50 g edible, 1 slice bread ≈ 30 g).",
    inputSchema: {
      type: 'object',
      required: ['name', 'weight_g'],
      properties: {
        name: { type: 'string', description: "Food name, e.g. 'chicken breast', 'oats', 'banana'" },
        weight_g: { type: 'number', description: 'Total grams eaten' },
        meal_type: MEAL,
        date: DATE,
        ...MACROS_100G,
      },
    },
    annotations: WRITE,
  },
  {
    name: 'log_foods',
    title: 'Log several foods at once',
    description:
      "Log a whole meal made of several foods in one call (e.g. 'for lunch I had 150g rice, 200g chicken and a salad'). Same rules as log_food for each item. Returns per-item results; items not found are reported so you can retry them with macros.",
    inputSchema: {
      type: 'object',
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'weight_g'],
            properties: { name: { type: 'string' }, weight_g: { type: 'number' }, ...MACROS_100G },
          },
        },
        meal_type: MEAL,
        date: DATE,
      },
    },
    annotations: WRITE,
  },
  {
    name: 'log_meal',
    title: 'Log a saved recipe',
    description:
      "Log portions of one of the user's saved recipes. Use when the user names a dish they've saved (check get_overview's frequent list or list_recipes for the recipe_id).",
    inputSchema: {
      type: 'object',
      required: ['recipe_id'],
      properties: {
        recipe_id: { type: 'integer' },
        portions_eaten: { type: 'number', description: 'Defaults to 1' },
        meal_type: MEAL,
        date: DATE,
      },
    },
    annotations: WRITE,
  },
  {
    name: 'log_ingredient',
    title: 'Log an ingredient by id',
    description: 'Log grams of a specific ingredient when you already know its id (from search_ingredient or a not-found candidate list).',
    inputSchema: {
      type: 'object',
      required: ['ingredient_id', 'weight_g'],
      properties: { ingredient_id: { type: 'integer' }, weight_g: { type: 'number' }, meal_type: MEAL, date: DATE },
    },
    annotations: WRITE,
  },
  {
    name: 'quick_add_calories',
    title: 'Quick-add calories',
    description:
      "Log a one-off entry with just a name and calories (optionally macros) — for restaurant meals or things with no sensible ingredient breakdown. Prefer log_food/log_foods for real foods.",
    inputSchema: {
      type: 'object',
      required: ['name', 'calories'],
      properties: {
        name: { type: 'string' },
        calories: { type: 'number' },
        protein: { type: 'number' },
        carbs: { type: 'number' },
        fat: { type: 'number' },
        meal_type: MEAL,
        date: DATE,
      },
    },
    annotations: WRITE,
  },
  {
    name: 'copy_meals',
    title: 'Copy meals from another day',
    description: "Copy logged meals from one day to another ('same breakfast as yesterday'). Optionally only one meal type.",
    inputSchema: {
      type: 'object',
      required: ['from_date'],
      properties: {
        from_date: DATE,
        to_date: { ...DATE, description: 'Target date; defaults to today.' },
        meal_type: { ...MEAL, description: 'Only copy this meal type. Omit to copy the whole day.' },
      },
    },
    annotations: WRITE,
  },
  {
    name: 'update_log_entry',
    title: 'Edit a logged entry',
    description:
      "Fix a logged entry: change the amount (weight_g for single foods, or portions_eaten for recipes), the meal type, or move it to another date. Get the id from get_day_summary.",
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'integer' },
        weight_g: { type: 'number', description: 'New grams (single-food entries only)' },
        portions_eaten: { type: 'number' },
        meal_type: MEAL,
        date: DATE,
      },
    },
    annotations: WRITE,
  },
  {
    name: 'delete_log_entry',
    title: 'Delete a logged entry',
    description: 'Remove a logged entry by id (get ids from get_day_summary). Confirm with the user first if it is ambiguous which entry they mean.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
    annotations: DESTRUCTIVE,
  },

  // ── Reading history ───────────────────────────────────────────────────────
  {
    name: 'get_day_summary',
    title: 'Day summary',
    description: "Everything eaten on one day (entries with ids, grams/portions and macros), totals, goals and remaining. Use for 'what did I eat yesterday', 'how much protein left today'.",
    inputSchema: { type: 'object', properties: { date: DATE } },
    annotations: READ,
  },
  {
    name: 'get_range_summary',
    title: 'Summary over a date range',
    description:
      "Per-day totals and averages between two dates (max 93 days), plus how many days were within / over the calorie goal. Use for weekly or monthly questions, trends and 'how am I doing'. Defaults to the last 7 days.",
    inputSchema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'YYYY-MM-DD. Defaults to 6 days before end_date.' },
        end_date: DATE,
      },
    },
    annotations: READ,
  },

  // ── Goals & weight ────────────────────────────────────────────────────────
  {
    name: 'get_goals',
    title: 'Get goals',
    description: 'Daily calorie/protein/carbs/fat goals and target weight.',
    inputSchema: { type: 'object', properties: {} },
    annotations: READ,
  },
  {
    name: 'update_goals',
    title: 'Update goals',
    description: 'Change one or more daily goals or the target weight. Only pass the fields that change.',
    inputSchema: {
      type: 'object',
      properties: {
        calorie_goal: { type: 'number' },
        protein_goal: { type: 'number' },
        carbs_goal: { type: 'number' },
        fat_goal: { type: 'number' },
        weight_target: { type: 'number', description: 'kg' },
      },
    },
    annotations: WRITE,
  },
  {
    name: 'log_weight',
    title: 'Log body weight',
    description: 'Record body weight in kg for a date (replaces an existing entry for that date). Convert lb to kg yourself (× 0.4536).',
    inputSchema: { type: 'object', required: ['weight_kg'], properties: { weight_kg: { type: 'number' }, date: DATE } },
    annotations: WRITE,
  },
  {
    name: 'get_weight_history',
    title: 'Weight history',
    description: 'Weight entries for the last N days (default 90) with total change, average weekly change and distance to target.',
    inputSchema: { type: 'object', properties: { days: { type: 'integer', description: 'Default 90, max 730' } } },
    annotations: READ,
  },

  // ── Ingredients & recipes ─────────────────────────────────────────────────
  {
    name: 'search_ingredient',
    title: 'Search ingredients',
    description: "Fuzzy-search the user's ingredient list by name. Returns best matches first with per-100g macros and ids.",
    inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' } } },
    annotations: READ,
  },
  {
    name: 'list_ingredients',
    title: 'List all ingredients',
    description: "All ingredients the user can use, with per-100g macros. Prefer search_ingredient unless the full list is needed.",
    inputSchema: { type: 'object', properties: {} },
    annotations: READ,
  },
  {
    name: 'add_ingredient',
    title: 'Add an ingredient',
    description: 'Save a new ingredient with per-100g nutrition (e.g. from a label the user describes). Not needed before log_food — it can create ingredients itself.',
    inputSchema: {
      type: 'object',
      required: ['name', 'calories_100g'],
      properties: {
        name: { type: 'string' },
        ...MACROS_100G,
        category: { type: 'string', enum: ['Protein', 'Carb', 'Fat', 'Vegetable', 'Fruit', 'Sauce', 'Dairy', 'Other'] },
        brand: { type: 'string' },
        serving_label: { type: 'string', description: "e.g. '1 scoop'" },
        serving_grams: { type: 'number' },
      },
    },
    annotations: WRITE,
  },
  {
    name: 'update_ingredient',
    title: 'Correct an ingredient',
    description: "Fix an ingredient's name or nutrition. Note: logged meals are calculated from ingredient values, so this also changes past days that used it.",
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'integer' }, name: { type: 'string' }, ...MACROS_100G, brand: { type: 'string' }, serving_label: { type: 'string' }, serving_grams: { type: 'number' } },
    },
    annotations: WRITE,
  },
  {
    name: 'scan_barcode',
    title: 'Look up a barcode',
    description: 'Look up a product barcode on OpenFoodFacts and save it to the ingredient list (or return the existing one).',
    inputSchema: { type: 'object', required: ['barcode'], properties: { barcode: { type: 'string' } } },
    annotations: { ...WRITE, openWorldHint: true },
  },
  {
    name: 'list_recipes',
    title: 'List recipes',
    description: 'All saved recipes with ids, portions and macros per portion.',
    inputSchema: { type: 'object', properties: {} },
    annotations: READ,
  },
  {
    name: 'get_recipe',
    title: 'Recipe details',
    description: 'One recipe with its ingredients (grams each) and macros per portion. Pass recipe_id or a name.',
    inputSchema: { type: 'object', properties: { recipe_id: { type: 'integer' }, name: { type: 'string' } } },
    annotations: READ,
  },
  {
    name: 'create_recipe',
    title: 'Create a recipe',
    description:
      "Save a recipe the user cooks often. Each ingredient can be given by ingredient_id or by name (matched against the user's list). 'portions' is how many servings the whole recipe makes.",
    inputSchema: {
      type: 'object',
      required: ['name', 'ingredients'],
      properties: {
        name: { type: 'string' },
        portions: { type: 'number', description: 'Servings the recipe makes. Default 1.' },
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            required: ['weight_g'],
            properties: { ingredient_id: { type: 'integer' }, name: { type: 'string' }, weight_g: { type: 'number' } },
          },
        },
      },
    },
    annotations: WRITE,
  },
  {
    name: 'delete_recipe',
    title: 'Delete a recipe',
    description: 'Archive a saved recipe. Past logs that used it are kept.',
    inputSchema: { type: 'object', required: ['recipe_id'], properties: { recipe_id: { type: 'integer' } } },
    annotations: DESTRUCTIVE,
  },
];

// Old action names still accepted by /api/gpt (older GPT/MCP configs).
export const ALIASES = {
  get_today_summary: 'get_day_summary',
  get_history: 'get_day_summary',
  get_weekly_stats: 'get_range_summary',
};

export const SERVER_INSTRUCTIONS = `You are connected to the user's personal meal & nutrition tracker.

How to work:
- At the start of a conversation (or whenever you need today's date), call get_overview. Never guess today's date; dates default to the user's local "today".
- When the user says they ate something, log it right away — don't ask for confirmation unless the amount is truly unclear. Estimate grams from everyday portions (1 large egg ≈ 50 g, 1 cup cooked rice ≈ 160 g, 1 slice bread ≈ 30 g, 1 tbsp oil ≈ 14 g) and say what you assumed.
- One food → log_food. Several foods in one meal → log_foods. A saved dish → log_meal (ids are in get_overview's frequent list or list_recipes). Restaurant/unknown food → quick_add_calories with your best estimate.
- If log_food returns ingredient_not_found: if a candidate clearly matches, use log_ingredient with its id; otherwise call log_food again with calories_100g/protein_100g/carbs_100g/fat_100g from your knowledge.
- Infer meal_type from context or time of day when not stated (before 11:00 Breakfast, 11–16 Lunch, 16–21 Dinner, otherwise Snack).
- After logging, reply briefly with what was logged and what's left for the day (calories and protein).
- To fix or remove something, look up the entry id with get_day_summary, then update_log_entry or delete_log_entry.
- For "how am I doing / this week / this month" use get_range_summary; for weight questions use get_weight_history.
- Units: weights in grams, body weight in kg, energy in kcal.`;
