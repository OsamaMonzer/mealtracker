# MealTracker MCP Server

This MCP server gives any compatible AI (Claude Desktop, Cursor, etc.) full read/write access to your MealTracker app.

## Tools Available

| Tool | What it does |
|---|---|
| `get_today_summary` | Calories eaten, remaining, weekly avg, today's meals |
| `get_history` | All meals for a specific date |
| `get_weekly_stats` | Macro averages across last 7 days |
| `search_ingredient` | Search local DB + OpenFoodFacts |
| `list_ingredients` | All ingredients in your DB |
| `list_recipes` | All saved recipes with macros |
| `log_meal` | Log eating a recipe by ID |
| `log_ingredient` | Log an ingredient by weight (grams) |
| `quick_add_calories` | Log calories with just a name + number |
| `create_recipe` | Create a new recipe with ingredients |
| `add_ingredient` | Add an ingredient to your DB |
| `scan_barcode` | Look up a barcode and save to DB |
| `get_goals` | Get daily nutrition goals |
| `update_goals` | Update daily nutrition goals |
| `delete_log_entry` | Delete a meal log entry by ID |

## Setup

### 1. Install dependencies

```bash
cd mcp-server
npm install
```

### 2. Configure Claude Desktop

Open your Claude Desktop config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this block inside the `mcpServers` object:

```json
{
  "mcpServers": {
    "mealtracker": {
      "command": "node",
      "args": ["/FULL/PATH/TO/mealtracker/mcp-server/index.js"],
      "env": {
        "MEALTRACKER_URL": "https://your-deployed-app-url.com",
        "MEALTRACKER_API_KEY": "mealtracker-shortcut-2024"
      }
    }
  }
}
```

Replace `/FULL/PATH/TO/mealtracker` with the actual path on your machine.  
Replace `https://your-deployed-app-url.com` with your real app URL (or `http://localhost:3000` if running locally).

### 3. Restart Claude Desktop

After saving the config, restart Claude Desktop. You should see a 🔧 icon in the chat input — that confirms the MCP server is connected.

---

## Example Prompts

```
"What did I eat today and how many calories do I have left?"
"Log that I had 200g of chicken breast for lunch"
"Create a recipe called Protein Bowl with chicken, rice, and broccoli, 150g each, 2 portions"
"What are my average macros this week?"
"I just ate a Big Mac, quick add 550 calories as dinner"
"Update my protein goal to 180g"
"What ingredients do I have in my database?"
```
