#!/usr/bin/env node
// Local stdio bridge for MCP clients that only support stdio (e.g. older Claude Desktop configs).
// It forwards every JSON-RPC message to the app's hosted MCP endpoint (/api/mcp), so the
// tool list and behaviour always match the deployed app. No dependencies needed.
//
// Env: MEALTRACKER_URL      e.g. https://mealtracker-eosin.vercel.app
//      MEALTRACKER_API_KEY  same value as on Vercel

import readline from 'node:readline';

const BASE_URL = (process.env.MEALTRACKER_URL || 'http://localhost:3000').replace(/\/$/, '');
const API_KEY = process.env.MEALTRACKER_API_KEY;
if (!API_KEY) {
  console.error('MEALTRACKER_API_KEY is not set — add it to the MCP server env config.');
  process.exit(1);
}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');

async function forward(msg) {
  try {
    const res = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(msg),
    });
    if (res.status === 202) return; // notification
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    if (data && (data.jsonrpc || Array.isArray(data))) return send(data);
    if (res.status === 401) {
      if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: -32001, message: 'Unauthorized — MEALTRACKER_API_KEY does not match the one on Vercel' } });
      return;
    }
    if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: `HTTP ${res.status}: ${text.slice(0, 200)}` } });
  } catch (e) {
    if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: `Cannot reach ${BASE_URL}: ${e.message}` } });
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  forward(msg);
});
