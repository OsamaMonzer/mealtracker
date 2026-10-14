# Connecting AI assistants to Meal Tracker

There is one set of 24 tools, and three ways to reach it:

| Client | Endpoint | Auth |
|---|---|---|
| Custom GPT (ChatGPT "Actions") | `https://mealtracker-eosin.vercel.app/openapi.json` | Bearer = `MEALTRACKER_API_KEY` |
| MCP clients (Claude, ChatGPT connectors, Cursor, Perplexity…) | `https://mealtracker-eosin.vercel.app/api/mcp` | `Authorization: Bearer <key>` header, or `?key=<key>` in the URL |
| Old integrations | `POST /api/gpt` with `{ "action": "...", ... }` | same key |

Vercel needs `MEALTRACKER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and (optionally) `APP_TIMEZONE=Asia/Kuala_Lumpur`.

---

## 1. Custom GPT

1. ChatGPT → **Explore GPTs → Create → Configure**.
2. **Actions → Create new action → Import from URL** → `https://mealtracker-eosin.vercel.app/openapi.json`
   (if you had the old schema pasted in, delete it first).
3. **Authentication → API Key → Auth Type: Bearer** → paste your `MEALTRACKER_API_KEY`.
4. Paste the text below into **Instructions**.
5. Save, then try: *"What's left for today?"*

When the app gets new tools later, click **Import from URL** again to refresh them.

### GPT instructions (paste this)

```
You are my nutrition assistant, connected to my personal meal tracker through actions.

Always:
- At the start of a conversation, or whenever you need today's date, call get_overview. Never guess today's date.
- When I say I ate or drank something, log it straight away without asking for confirmation, unless the amount is truly unclear. Estimate grams from normal portions (1 large egg ≈ 50 g, 1 cup cooked rice ≈ 160 g, 1 slice bread ≈ 30 g, 1 tbsp oil ≈ 14 g, 1 medium banana ≈ 120 g) and tell me what you assumed.
- One food → log_food. Several foods in one meal → log_foods. A dish I've saved → log_meal (recipe ids are in get_overview's frequent_foods or list_recipes). Restaurant food or something without a clear breakdown → quick_add_calories with your best estimate including protein/carbs/fat.
- If log_food says ingredient_not_found: use log_ingredient if one of the candidates is clearly the same food; otherwise call log_food again with calories_100g, protein_100g, carbs_100g and fat_100g from your own knowledge.
- If I don't say which meal, infer it from what I say or the local time in get_overview (before 11:00 Breakfast, 11–16 Lunch, 16–21 Dinner, otherwise Snack).
- After logging, answer in 1–3 short lines: what was logged (grams + kcal) and what's left today (kcal and protein).
- To correct or remove something, find the entry id with get_day_summary, then use update_log_entry or delete_log_entry. "Same breakfast as yesterday" → copy_meals.
- "How am I doing / this week / this month" → get_range_summary. Weight questions → get_weight_history. "I weigh 80.4" → log_weight (kg).
- Use grams, kg and kcal. Keep answers short and practical; suggest foods to hit remaining protein when useful.
```

---

## 2. MCP connectors

**Claude (claude.ai or Desktop)** → Settings → Connectors → *Add custom connector*
URL: `https://mealtracker-eosin.vercel.app/api/mcp?key=<MEALTRACKER_API_KEY>` (no OAuth).
The server sends its own instructions, so no extra prompt is needed.

**ChatGPT connectors** (needs a plan with custom connectors / developer mode):
same URL with `?key=`, authentication "No authentication".

**Cursor / clients with headers**: URL `https://mealtracker-eosin.vercel.app/api/mcp`, header `Authorization: Bearer <key>`.

**Stdio-only clients**: see `mcp-server/README.md` (a tiny bridge that forwards to the URL above).

> Treat a URL that contains `?key=` like a password. If it leaks, change `MEALTRACKER_API_KEY` on Vercel and redeploy.

---

## 3. Things you can say

- "I had 3 eggs and 2 slices of toast for breakfast"
- "Lunch was nasi lemak from the mamak" → quick-add estimate
- "Same breakfast as yesterday"
- "Actually the chicken was 150 g, not 200"
- "How much protein do I still need today? Give me ideas to hit it"
- "How did I do this week vs my goal?"
- "I weigh 80.4 kg today — am I on track for my target?"
- "Save a recipe: chicken rice bowl, 300 g chicken breast, 360 g cooked rice, makes 2 portions"
- "Change my calorie goal to 1900"

## Tools

`get_overview` (start here) · `log_food` · `log_foods` · `log_meal` · `log_ingredient` · `quick_add_calories` · `copy_meals` · `update_log_entry` · `delete_log_entry` · `get_day_summary` · `get_range_summary` · `get_goals` · `update_goals` · `log_weight` · `get_weight_history` · `search_ingredient` · `list_ingredients` · `add_ingredient` · `update_ingredient` · `scan_barcode` · `list_recipes` · `get_recipe` · `create_recipe` · `delete_recipe`

Tool definitions live in `src/lib/ai/tools.js`; the logic is in `src/lib/ai/actions.js`.
