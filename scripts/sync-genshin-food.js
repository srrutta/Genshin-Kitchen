import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import genshinDB from 'genshin-db';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MENU_PATH = path.join(ROOT_DIR, 'menu.json');
const MERGED_PATH = path.join(ROOT_DIR, 'menu.merged.json');
const REPORT_PATH = path.join(ROOT_DIR, 'scripts', 'sync-report.json');
const BACKUP_PATH = path.join(ROOT_DIR, 'menu.json.bak2');

export function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

function similarity(left, right) {
  if (!left || !right) return 0;
  return 1 - levenshteinDistance(left, right) / Math.max(left.length, right.length);
}

function findSuggestions(name, candidates) {
  const normalizedName = normalizeName(name);
  return candidates
    .map((candidate) => ({
      name: candidate.name,
      score: similarity(normalizedName, normalizeName(candidate.name)),
    }))
    .filter((candidate) => candidate.score >= 0.7)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 3)
    .map(({ name: candidateName, score }) => ({ name: candidateName, score: Number(score.toFixed(3)) }));
}

export function matchMenuItems(shopItems, apiFoods, matchingFoods = apiFoods) {
  const apiFoodsById = new Map(apiFoods.map((food) => [food.id, food]));
  const matchingFoodsById = new Map(matchingFoods.map((food) => [food.id, food]));
  const apiByName = new Map(
    matchingFoods.map((food) => [normalizeName(food.name), apiFoodsById.get(food.id)]),
  );
  const matched = [];
  const onlyInShop = [];
  const matchedApiIds = new Set();

  for (const item of shopItems) {
    const food = apiByName.get(normalizeName(item.name));
    if (food) {
      matched.push({ item, food });
      matchedApiIds.add(food.id);
    } else {
      onlyInShop.push({
        shopName: item.name,
        suggestions: findSuggestions(item.name, matchingFoods),
      });
    }
  }

  const onlyInApi = apiFoods
    .filter((food) => !matchedApiIds.has(food.id))
    .map((food) => ({
      apiName: food.name,
      suggestions: findSuggestions(
        matchingFoodsById.get(food.id)?.name ?? food.name,
        shopItems.map((item) => ({ name: item.name })),
      ),
    }));

  onlyInShop.sort((a, b) => a.shopName.localeCompare(b.shopName));
  onlyInApi.sort((a, b) => a.apiName.localeCompare(b.apiName));
  return { matched, onlyInShop, onlyInApi };
}

function parseArguments(argv, envLanguage = process.env.GENSHIN_DB_LANGUAGE ?? 'English') {
  const options = { language: envLanguage, write: false, excludeTrial: false };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--write') options.write = true;
    else if (argument === '--exclude-trial') options.excludeTrial = true;
    else if (argument === '--language') options.language = argv[++index];
    else if (argument.startsWith('--language=')) options.language = argument.slice('--language='.length);
    else throw new Error(`Unknown option: ${argument}`);
  }
  if (!['English', 'Thai'].includes(options.language)) {
    throw new Error(`Unsupported language "${options.language}". Use English or Thai.`);
  }
  return options;
}

export function createMergedMenu(shopItems, matched) {
  const genshinByItem = new Map(matched.map(({ item, food }) => [item, food]));
  return shopItems.map((item) => {
    const food = genshinByItem.get(item);
    return food ? { ...item, genshin: food } : { ...item };
  });
}

export function createReport(matches, { excludeTrial = false } = {}) {
  const onlyInApi = excludeTrial
    ? matches.onlyInApi.filter(({ apiName }) => !apiName.toLowerCase().includes('trial'))
    : matches.onlyInApi;
  onlyInApi.sort((a, b) => a.apiName.localeCompare(b.apiName));
  return {
    matched: matches.matched
      .map(({ item, food }) => ({ shopName: item.name, apiName: food.name }))
      .sort((a, b) => a.shopName.localeCompare(b.shopName)),
    onlyInShop: matches.onlyInShop,
    onlyInApi,
  };
}

export function runSync(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const shopItems = JSON.parse(fs.readFileSync(MENU_PATH, 'utf8'));
  if (!Array.isArray(shopItems)) throw new Error('menu.json must contain an array of menu items.');

  genshinDB.setOptions({ resultLanguage: 'English' });
  const matchingFoods = genshinDB.foods('names', {
    matchCategories: true,
    verboseCategories: true,
  });
  if (!Array.isArray(matchingFoods)) throw new Error('genshin-db did not return an English food list.');

  genshinDB.setOptions({ resultLanguage: options.language });
  const apiFoods = options.language === 'English'
    ? matchingFoods
    : genshinDB.foods('names', {
      matchCategories: true,
      verboseCategories: true,
    });
  if (!Array.isArray(apiFoods)) throw new Error('genshin-db did not return a food list.');

  const matches = matchMenuItems(shopItems, apiFoods, matchingFoods);
  const mergedMenu = createMergedMenu(shopItems, matches.matched);
  const report = createReport(matches, options);
  const mergedJSON = `${JSON.stringify(mergedMenu, null, 2)}\n`;
  const reportJSON = `${JSON.stringify(report, null, 2)}\n`;

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(MERGED_PATH, mergedJSON);
  fs.writeFileSync(REPORT_PATH, reportJSON);

  if (options.write) {
    fs.copyFileSync(MENU_PATH, BACKUP_PATH, fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(MENU_PATH, mergedJSON);
  }

  console.log(`Matched ${matches.matched.length} of ${shopItems.length} shop foods.`);
  console.log(`Wrote ${path.relative(ROOT_DIR, MERGED_PATH)} and ${path.relative(ROOT_DIR, REPORT_PATH)}.`);
  if (options.write) console.log(`Updated menu.json; original backed up to ${path.basename(BACKUP_PATH)}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    runSync();
  } catch (error) {
    console.error(`Food sync failed: ${error.message}`);
    process.exitCode = 1;
  }
}
