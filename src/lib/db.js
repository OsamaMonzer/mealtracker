import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { sql } from '@vercel/postgres';

const dbPath = path.resolve(process.cwd(), 'meals.db');
let initialized = false;

async function ensureTablesExist(db) {
  if (initialized) return;
  initialized = true;
  const isPostgres = !!process.env.POSTGRES_URL;
  const idType = isPostgres ? 'SERIAL' : 'INTEGER';
  const autoInc = isPostgres ? '' : 'AUTOINCREMENT';

  await db.run(`CREATE TABLE IF NOT EXISTS ingredients (
    id ${idType} PRIMARY KEY ${autoInc}, name TEXT NOT NULL, category TEXT NOT NULL,
    brand TEXT, status TEXT NOT NULL, calories_100g REAL NOT NULL,
    protein_100g REAL NOT NULL, carbs_100g REAL NOT NULL, fat_100g REAL NOT NULL,
    price_kg REAL, notes TEXT)`);
  await db.run(`CREATE TABLE IF NOT EXISTS recipes (
    id ${idType} PRIMARY KEY ${autoInc}, name TEXT NOT NULL,
    portions INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await db.run(`CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id ${idType} PRIMARY KEY ${autoInc}, recipe_id INTEGER,
    ingredient_id INTEGER, weight_g REAL NOT NULL)`);
  await db.run(`CREATE TABLE IF NOT EXISTS daily_logs (
    id ${idType} PRIMARY KEY ${autoInc}, date TEXT NOT NULL, meal_type TEXT NOT NULL,
    recipe_id INTEGER NOT NULL, portions_eaten REAL NOT NULL)`);
  await db.run(`CREATE TABLE IF NOT EXISTS weight_logs (
    id ${idType} PRIMARY KEY ${autoInc}, date TEXT NOT NULL, weight_kg REAL NOT NULL)`);
}

export async function openDb() {
  if (process.env.POSTGRES_URL) {
    const translateQuery = (q) => {
      let i = 0;
      return q.replace(/\?/g, () => `$${++i}`);
    };

    const db = {
      all: async (query, ...params) => {
        const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const { rows } = await sql.query(translateQuery(query), p);
        return rows;
      },
      get: async (query, ...params) => {
        const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const { rows } = await sql.query(translateQuery(query), p);
        return rows[0] || null;
      },
      run: async (query, ...params) => {
        const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        let isInsert = query.trim().toUpperCase().startsWith('INSERT');
        let pgQuery = translateQuery(query);
        if (isInsert && !pgQuery.toUpperCase().includes('RETURNING')) {
          pgQuery += ' RETURNING id';
        }
        const { rows } = await sql.query(pgQuery, p);
        return { lastID: rows[0]?.id };
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
