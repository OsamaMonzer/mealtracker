import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { sql } from '@vercel/postgres';

const dbPath = path.resolve(process.cwd(), 'meals.db');

export async function openDb() {
  if (process.env.POSTGRES_URL) {
    const translateQuery = (q) => {
      let i = 0;
      return q.replace(/\?/g, () => `$${++i}`);
    };

    return {
      all: async (query, ...params) => {
        const { rows } = await sql.query(translateQuery(query), params);
        return rows;
      },
      get: async (query, ...params) => {
        const { rows } = await sql.query(translateQuery(query), params);
        return rows[0] || null;
      },
      run: async (query, ...params) => {
        let isInsert = query.trim().toUpperCase().startsWith('INSERT');
        let pgQuery = translateQuery(query);
        if (isInsert && !pgQuery.toUpperCase().includes('RETURNING')) {
          pgQuery += ' RETURNING id';
        }
        const { rows } = await sql.query(pgQuery, params);
        return { lastID: rows[0]?.id };
      }
    };
  }

  return open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
}
