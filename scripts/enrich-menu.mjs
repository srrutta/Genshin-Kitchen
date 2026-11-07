#!/usr/bin/env node
// Enrich menu.json from the public genshin-db API.
// ADDITIVE + IN-PLACE: existing fields are never overwritten, and the original file layout
// (column alignment, blank lines, key order) is preserved. New fields are appended to the end
// of each item's own line only.
//   node scripts/enrich-menu.mjs            -> write menu.json (backup: menu.json.bak)
//   node scripts/enrich-menu.mjs --dry-run  -> only print the report
// Adds when missing: effect (recovery|def|atk|adventurer), effectDescription, rarity, foodType, foodFilter, description, ingredients
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MENU = path.join(ROOT, 'menu.json');
const MAP = path.join(ROOT, 'scripts', 'name-map.json');
const API = process.env.GENSHIN_DB_API || 'https://genshin-db-api.vercel.app/api/v5';
const DRY = process.argv.includes('--dry-run');

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const get = async (url) => {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};
const qs = (o) => new URLSearchParams({ resultLanguage: 'English', queryLanguages: 'English', ...o }).toString();

function effectId(food) {
  const t = `${food.filterType ?? ''} ${food.filterText ?? ''} ${food.foodtype ?? ''}`.toLowerCase();
  if (t.includes('recover')) return 'recovery';
  if (t.includes('def')) return 'def';
  if (t.includes('atk')) return 'atk';
  if (t.includes('stamina') || t.includes('adventurer')) return 'adventurer';
  return null;
}
const ingredientNames = (list) =>
  Array.isArray(list) ? list.map((i) => (typeof i === 'string' ? i : i?.name)).filter(Boolean) : [];

const rawText = fs.readFileSync(MENU, 'utf8');
const menu = JSON.parse(rawText);
const overrides = fs.existsSync(MAP) ? JSON.parse(fs.readFileSync(MAP, 'utf8')) : {};
const names = await get(`${API}/foods?${qs({ query: 'names', matchCategories: 'true' })}`);
if (!Array.isArray(names) || !names.length) throw new Error('API returned no food names; check the URL/response shape');
const byNorm = new Map(names.map((n) => [norm(n), n]));

const cache = new Map();
const fetchFood = async (name) => {
  if (!cache.has(name)) {
    const data = await get(`${API}/foods?${qs({ query: name })}`);
    cache.set(name, Array.isArray(data) ? data[0] : data);
  }
  return cache.get(name);
};

const report = { enriched: [], unmatched: [], skipped: [], noChange: [] };
const added = new Map(); // item.id -> { key: value } (only the NEW fields)
for (const item of menu) {
  if (Object.hasOwn(overrides, item.name) && overrides[item.name] === null) { report.skipped.push(item.name); continue; }
  const apiName = byNorm.get(norm(overrides[item.name] ?? item.name)) ?? null;
  if (!apiName) { report.unmatched.push(item.name); continue; }
  let food;
  try { food = await fetchFood(apiName); } catch (e) { report.unmatched.push(`${item.name} (${e.message})`); continue; }
  if (!food) { report.unmatched.push(item.name); continue; }

  const additions = {
    effect: effectId(food),
    effectDescription: food.effect,
    rarity: food.rarity,
    foodType: food.foodtype,
    foodFilter: food.filterText ?? food.filterType,
    description: food.description,
    ingredients: ingredientNames(food.ingredients),
  };
  const fresh = {};
  for (const [key, value] of Object.entries(additions)) {
    const empty = item[key] === undefined || item[key] === null || (Array.isArray(item[key]) && !item[key].length);
    const has = value !== undefined && value !== null && !(Array.isArray(value) && !value.length);
    if (empty && has) fresh[key] = value;
  }
  if (Object.keys(fresh).length) { added.set(item.id, fresh); report.enriched.push(item.name); }
  else report.noChange.push(item.name);
}

console.log(`API foods: ${names.length} | enriched: ${report.enriched.length} | unchanged: ${report.noChange.length} | skipped: ${report.skipped.length} | unmatched: ${report.unmatched.length}`);
if (report.unmatched.length) console.log('\nUnmatched (add to scripts/name-map.json):\n - ' + [...new Set(report.unmatched)].join('\n - '));
console.log('\nSample API names:', names.slice(0, 8).join(', '));

// ---- patch menu.json in place (one line per item; append new keys before the closing brace) ----
function patchInPlace() {
  const eol = rawText.includes('\r\n') ? '\r\n' : '\n';
  const lines = rawText.split(eol);
  const lineOf = new Map();
  lines.forEach((l, i) => {
    const m = l.match(/^\s*\{\s*"id"\s*:\s*(\d+)\s*,/);
    if (m) lineOf.set(Number(m[1]), i);
  });
  const fallback = [];
  for (const [id, fresh] of added) {
    const i = lineOf.get(id);
    const m = i === undefined ? null : lines[i].match(/^(.*\S)\s*\}(\s*,?\s*)$/);
    const keysAlreadyPresent = menu.find((x) => x.id === id) && Object.keys(fresh).some((k) => k in menu.find((x) => x.id === id));
    if (!m || keysAlreadyPresent) { fallback.push(id); continue; }
    const extra = Object.entries(fresh).map(([k, v]) => `"${k}": ${JSON.stringify(v)}`).join(', ');
    lines[i] = `${m[1]}, ${extra} }${m[2]}`;
  }
  if (fallback.length) throw new Error(`Could not patch these ids in place (unusual line layout): ${fallback.join(', ')}. Nothing was written.`);
  return lines.join(eol);
}

if (added.size) {
  const patched = patchInPlace();
  // Safety check: result must parse, and every original field of every item must be unchanged.
  const after = JSON.parse(patched);
  if (after.length !== menu.length) throw new Error('Item count changed; aborting without writing.');
  for (let i = 0; i < menu.length; i++) {
    for (const [k, v] of Object.entries(menu[i])) {
      if (JSON.stringify(after[i][k]) !== JSON.stringify(v)) throw new Error(`Original field changed: id ${menu[i].id} "${k}". Aborting without writing.`);
    }
  }
  if (!DRY) {
    fs.copyFileSync(MENU, `${MENU}.bak`);
    fs.writeFileSync(MENU, patched);
    console.log(`\nWrote ${MENU} (backup: menu.json.bak). Original fields verified unchanged for all ${menu.length} items.`);
  } else {
    console.log(`\n(dry-run) would add fields to ${added.size} items; safety check passed, nothing written.`);
  }
} else {
  console.log('\nNothing to add.');
}
