const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function setup() {
  const dbPath = path.resolve(process.cwd(), 'meals.db');
  console.log(`Initializing database at ${dbPath}...`);
  
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  console.log('Dropping old tables if they exist...');
  await db.exec('DROP TABLE IF EXISTS meals');
  await db.exec('DROP TABLE IF EXISTS ingredients');
  await db.exec('DROP TABLE IF EXISTS recipes');
  await db.exec('DROP TABLE IF EXISTS recipe_ingredients');
  await db.exec('DROP TABLE IF EXISTS daily_logs');
  await db.exec('DROP TABLE IF EXISTS weight_logs');

  console.log('Creating new schema...');

  await db.exec(`
    CREATE TABLE ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      brand TEXT,
      status TEXT,
      calories_100g REAL NOT NULL,
      protein_100g REAL NOT NULL,
      carbs_100g REAL NOT NULL,
      fat_100g REAL NOT NULL,
      price_kg REAL,
      notes TEXT
    )
  `);

  await db.exec(`
    CREATE TABLE recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      portions INTEGER NOT NULL DEFAULT 1
    )
  `);

  await db.exec(`
    CREATE TABLE recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      weight_g REAL NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal_type TEXT,
      recipe_id INTEGER NOT NULL,
      portions_eaten REAL NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE weight_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      weight_kg REAL NOT NULL
    )
  `);

  console.log('Database initialized successfully with new schema.');
}

setup().catch(err => {
  console.error('Error initializing database:', err);
  process.exit(1);
});
