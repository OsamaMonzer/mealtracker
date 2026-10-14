# Meal Tracker MCP

The app itself is an MCP server at **`https://<your-domain>/api/mcp`** (Streamable HTTP).
Most clients can connect to that URL directly — this folder is only a fallback for
clients that need a local stdio server.

Tools: `get_overview` (start here), `log_food`, `log_foods`, `log_meal`, `log_ingredient`,
`quick_add_calories`, `copy_meals`, `update_log_entry`, `delete_log_entry`, `get_day_summary`,
`get_range_summary`, `get_goals`, `update_goals`, `log_weight`, `get_weight_history`,
`search_ingredient`, `list_ingredients`, `add_ingredient`, `update_ingredient`, `scan_barcode`,
`list_recipes`, `get_recipe`, `create_recipe`, `delete_recipe`.

## Connect directly (recommended)

- **Claude (claude.ai / Desktop → Settings → Connectors → Add custom connector)** or
  **ChatGPT (Settings → Connectors / developer mode → Create)**:
  URL `https://<your-domain>/api/mcp?key=<MEALTRACKER_API_KEY>`, authentication: none.
- **Clients that support headers** (Cursor, etc.): URL `https://<your-domain>/api/mcp`,
  header `Authorization: Bearer <MEALTRACKER_API_KEY>`.

## Local stdio bridge (fallback)

No `npm install` needed (Node 18+).

```json
{
  "mcpServers": {
    "mealtracker": {
      "command": "node",
      "args": ["C:/Users/Osama/Meal tracker/mcp-server/index.js"],
      "env": {
        "MEALTRACKER_URL": "https://<your-domain>",
        "MEALTRACKER_API_KEY": "<same value as MEALTRACKER_API_KEY on Vercel>"
      }
    }
  }
}
```
