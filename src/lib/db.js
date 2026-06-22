import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { Pool } from 'pg';

const dbPath = path.resolve(process.cwd(), 'meals.db');
let initialized = false;

function getPostgresUrl() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
}

function usePostgres() {
  const url = getPostgresUrl();
  return !!url;
}

let pgPool;
function getPgPool() {
  if (!pgPool) {
    pgPool = new Pool({ connectionString: getPostgresUrl() });
  }
  return pgPool;
}

async function ensureTablesExist(db) {
  if (initialized) return;
  initialized = true;
  const isPostgres = usePostgres();
  const idType = isPostgres ? 'SERIAL' : 'INTEGER';
  const autoInc = isPostgres ? '' : 'AUTOINCREMENT';

  await db.run(`CREATE TABLE IF NOT EXISTS ingredients (
    id ${idType} PRIMARY KEY ${autoInc}, name TEXT NOT NULL, category TEXT NOT NULL,
    brand TEXT, status TEXT NOT NULL, calories_100g REAL NOT NULL,
    protein_100g REAL NOT NULL, carbs_100g REAL NOT NULL, fat_100g REAL NOT NULL,
    price_kg REAL, notes TEXT, serving_label TEXT, serving_grams REAL)`);
  await db.run(`CREATE TABLE IF NOT EXISTS recipes (
    id ${idType} PRIMARY KEY ${autoInc}, name TEXT NOT NULL,
    portions INTEGER DEFAULT 1, status TEXT DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await db.run(`CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id ${idType} PRIMARY KEY ${autoInc}, recipe_id INTEGER,
    ingredient_id INTEGER, weight_g REAL NOT NULL)`);
  await db.run(`CREATE TABLE IF NOT EXISTS daily_logs (
    id ${idType} PRIMARY KEY ${autoInc}, date TEXT NOT NULL, meal_type TEXT NOT NULL,
    recipe_id INTEGER NOT NULL, portions_eaten REAL NOT NULL)`);
  await db.run(`CREATE TABLE IF NOT EXISTS weight_logs (
    id ${idType} PRIMARY KEY ${autoInc}, date TEXT NOT NULL, weight_kg REAL NOT NULL)`);
  // If an older DB exists, ensure new columns are present (best-effort)
  try {
    if (isPostgres) {
      // check columns in Postgres and add if missing
      const cols = await db.all("SELECT column_name FROM information_schema.columns WHERE table_name = 'ingredients'");
      const names = Array.isArray(cols) ? cols.map(c => c.column_name) : [];
      if (!names.includes('serving_label')) {
        try { await db.run('ALTER TABLE ingredients ADD COLUMN serving_label TEXT'); } catch (e) { console.warn('Could not add serving_label', e); }
      }
      if (!names.includes('serving_grams')) {
        try { await db.run('ALTER TABLE ingredients ADD COLUMN serving_grams REAL'); } catch (e) { console.warn('Could not add serving_grams', e); }
      }
      
      const recipeCols = await db.all("SELECT column_name FROM information_schema.columns WHERE table_name = 'recipes'");
      const recipeNames = Array.isArray(recipeCols) ? recipeCols.map(c => c.column_name) : [];
      if (!recipeNames.includes('status')) {
        try { await db.run("ALTER TABLE recipes ADD COLUMN status TEXT DEFAULT 'active'"); } catch (e) { }
      }
    } else {
      const cols = await db.all("PRAGMA table_info(ingredients)");
      const hasServing = Array.isArray(cols) && cols.some(c => c.name === 'serving_label');
      if (!hasServing) {
        await db.run('ALTER TABLE ingredients ADD COLUMN serving_label TEXT');
      }
      const hasServingGrams = Array.isArray(cols) && cols.some(c => c.name === 'serving_grams');
      if (!hasServingGrams) {
        try { await db.run('ALTER TABLE ingredients ADD COLUMN serving_grams REAL'); } catch (e) { }
      }

      const recipeCols = await db.all("PRAGMA table_info(recipes)");
      const hasStatus = Array.isArray(recipeCols) && recipeCols.some(c => c.name === 'status');
      if (!hasStatus) {
        try { await db.run("ALTER TABLE recipes ADD COLUMN status TEXT DEFAULT 'active'"); } catch (e) { }
      }
    }
  } catch (e) {
    // ignore - best-effort migration
    console.warn('Migration check failed', e);
  }
}

export async function openDb() {
  if (usePostgres()) {
    const translateQuery = (q) => {
      let i = 0;
      return q.replace(/\?/g, () => `$${++i}`);
    };

    const db = {
      all: async (query, ...params) => {
        const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const { rows } = await getPgPool().query(translateQuery(query), p);
        return rows;
      },
      get: async (query, ...params) => {
        const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const { rows } = await getPgPool().query(translateQuery(query), p);
        return rows[0] || null;
      },
      run: async (query, ...params) => {
        const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        let isInsert = query.trim().toUpperCase().startsWith('INSERT');
        let pgQuery = translateQuery(query);
        if (isInsert && !pgQuery.toUpperCase().includes('RETURNING')) {
          pgQuery += ' RETURNING id';
        }
        const { rows } = await getPgPool().query(pgQuery, p);
        return { lastID: rows[0]?.id };
      }
      ,
      exec: async (query, ...params) => {
        const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        // translate ? placeholders to $1, $2... for postgres
        const pgQuery = translateQuery(query);
        await getPgPool().query(pgQuery, p);
        return;
      }
    };

    await ensureTablesExist(db);
    return db;
  }

  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  await db.run('PRAGMA journal_mode=WAL');
  await ensureTablesExist(db);
  return db;
}
