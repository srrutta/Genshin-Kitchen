import { describe, expect, it } from 'vitest';
import {
  HashTable, MinHeap, Stack, buildSearchIndex, canNavigate, insertionSort, searchIndex,
} from '../src/graph.js';

describe('insertionSort', () => {
  it('เรียงน้อยไปมากโดยไม่แก้ array เดิม', () => {
    const src = [5, 2, 9, 1];
    expect(insertionSort(src)).toEqual([1, 2, 5, 9]);
    expect(src).toEqual([5, 2, 9, 1]);
  });
  it('stable เมื่อค่าเท่ากัน', () => {
    const list = [{ k: 1, n: 'a' }, { k: 1, n: 'b' }, { k: 0, n: 'c' }];
    expect(insertionSort(list, (x, y) => x.k - y.k).map((x) => x.n)).toEqual(['c', 'a', 'b']);
  });
});

describe('Stack', () => {
  it('LIFO', () => {
    const s = new Stack().push('home').push('menu');
    expect(s.pop()).toBe('menu');
    expect(s.peek()).toBe('home');
    expect(s.size).toBe(1);
  });
});

describe('MinHeap', () => {
  it('pop ตามลำดับค่าน้อยก่อน และเท่ากันเข้าก่อนออกก่อน', () => {
    const h = new MinHeap((x) => x.t);
    [{ t: 30, n: 'c' }, { t: 10, n: 'a' }, { t: 10, n: 'b' }, { t: 20, n: 'd' }].forEach((x) => h.push(x));
    expect(h.peek().n).toBe('a');
    expect([h.pop(), h.pop(), h.pop(), h.pop()].map((x) => x.n)).toEqual(['a', 'b', 'd', 'c']);
    expect(h.pop()).toBeUndefined();
  });
});

describe('HashTable search', () => {
  const index = buildSearchIndex([
    { id: 1, text: 'Good Hunter Mondstadt Teyvat Fried Egg' },
    { id: 2, text: "Shimura's Inazuma Sushi" },
  ]);
  it('ค้นหาตรงคำ', () => expect([...searchIndex(index, 'egg')]).toEqual([1]));
  it('เดาคำจาก prefix', () => expect([...searchIndex(index, 'sus')]).toEqual([2]));
  it('หลายคำเป็น AND', () => expect(searchIndex(index, 'good sushi').size).toBe(0));
  it('ช่องว่าง = ไม่กรอง (null)', () => expect(searchIndex(index, '  ')).toBeNull());
  it('HashTable.get คืน Set ว่างเมื่อไม่พบ', () => expect(new HashTable().get('x').size).toBe(0));
});

describe('Flow navigate', () => {
  it('อนุญาต/ไม่อนุญาตตามเอกสาร', () => {
    expect(canNavigate('home', 'menu')).toBe(true);
    expect(canNavigate('home', 'catalog')).toBe(true);
    expect(canNavigate('catalog', 'menu')).toBe(true);
    expect(canNavigate('home', 'checkout')).toBe(false);
    expect(canNavigate('cart', 'checkout')).toBe(true);
    expect(canNavigate('orders', 'login')).toBe(false);
  });
});
