import { describe, expect, it } from 'vitest';
import { createReport, matchMenuItems, normalizeName } from '../scripts/sync-genshin-food.js';

describe('Genshin food matching', () => {
  it('normalizes straight and curly apostrophes alike', () => {
    expect(normalizeName("Adeptus' Temptation")).toBe(normalizeName('adeptus’ temptation'));
  });

  it('matches names after punctuation normalization', () => {
    const result = matchMenuItems(
      [{ name: "Adeptus' Temptation" }],
      [{ name: 'adeptus’ temptation', id: 1 }],
    );

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].food.id).toBe(1);
    expect(result.onlyInShop).toEqual([]);
    expect(result.onlyInApi).toEqual([]);
  });

  it('matches by English names while keeping localized API data', () => {
    const localizedFood = { id: 1, name: 'ไข่ดาวเทย์วัต', description: 'คำบรรยายภาษาไทย' };
    const result = matchMenuItems(
      [{ name: 'Teyvat Fried Egg' }],
      [localizedFood],
      [{ id: 1, name: 'Teyvat Fried Egg' }],
    );

    expect(result.matched[0].food).toBe(localizedFood);
    expect(result.onlyInShop).toEqual([]);
    expect(result.onlyInApi).toEqual([]);
  });

  it('reports an unknown shop menu without throwing', () => {
    expect(() => matchMenuItems([{ name: 'Unlisted House Special' }], [])).not.toThrow();
    expect(matchMenuItems([{ name: 'Unlisted House Special' }], []).onlyInShop).toEqual([
      { shopName: 'Unlisted House Special', suggestions: [] },
    ]);
  });

  it('sorts API-only results and can exclude Trial names', () => {
    const report = createReport({
      matched: [],
      onlyInShop: [],
      onlyInApi: [{ apiName: 'Zucchini Soup' }, { apiName: 'Zesty Trial Dish' }, { apiName: 'Apple Soup' }],
    }, { excludeTrial: true });

    expect(report.onlyInApi).toEqual([{ apiName: 'Apple Soup' }, { apiName: 'Zucchini Soup' }]);
  });
});
