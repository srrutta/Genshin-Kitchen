// =====================================================================
// graph.js — โครงสร้างข้อมูล (DSA) ที่ใช้ในโปรเจกต์ + Graph ของ Flow Navigate
//   Stack          → Previous Page
//   MinHeap        → Priority Queue ของ OrderTrack (ประเมินเวลาถึงก่อน-หลัง)
//   HashTable      → ค้นหาร้าน/เมนูด้วย Keyword (รวมถึงการเดาคำ / prefix)
//   insertionSort  → Sort ร้านอาหารและเมนูทั้งหมด
//   FLOW           → Graph ของหน้าที่เดินไปหากันได้
// =====================================================================

// ---------- Stack (Previous Page) ----------
export class Stack {
  #items = [];
  push(value) { this.#items.push(value); return this; }
  pop() { return this.#items.pop(); }
  peek() { return this.#items[this.#items.length - 1]; }
  get size() { return this.#items.length; }
  isEmpty() { return this.#items.length === 0; }
  clear() { this.#items.length = 0; }
  toArray() { return [...this.#items]; }
}

// ---------- Priority Queue (Min-Heap) ----------
// keyFn(value) → ตัวเลขที่ยิ่งน้อยยิ่งมาก่อน, ถ้าเท่ากันใครเข้าก่อนออกก่อน
export class MinHeap {
  #heap = [];
  #seq = 0;
  #keyFn;

  constructor(keyFn = (x) => x) { this.#keyFn = keyFn; }

  get size() { return this.#heap.length; }
  isEmpty() { return this.#heap.length === 0; }
  peek() { return this.#heap[0]?.value; }

  #less(a, b) {
    const ka = this.#keyFn(a.value);
    const kb = this.#keyFn(b.value);
    return ka < kb || (ka === kb && a.seq < b.seq);
  }

  push(value) {
    const h = this.#heap;
    h.push({ value, seq: this.#seq++ });
    let i = h.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.#less(h[i], h[parent])) break;
      [h[i], h[parent]] = [h[parent], h[i]];
      i = parent;
    }
    return this;
  }

  pop() {
    const h = this.#heap;
    if (!h.length) return undefined;
    const top = h[0];
    const last = h.pop();
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < h.length && this.#less(h[l], h[smallest])) smallest = l;
        if (r < h.length && this.#less(h[r], h[smallest])) smallest = r;
        if (smallest === i) break;
        [h[i], h[smallest]] = [h[smallest], h[i]];
        i = smallest;
      }
    }
    return top.value;
  }
}

// ---------- Hash Table (chaining) ----------
export class HashTable {
  #buckets;

  constructor(capacity = 127) {
    this.#buckets = Array.from({ length: capacity }, () => []);
  }

  #hash(key) {
    let h = 5381; // djb2
    for (const ch of key) h = ((h << 5) + h + ch.codePointAt(0)) >>> 0;
    return h % this.#buckets.length;
  }

  add(key, id) {
    const bucket = this.#buckets[this.#hash(key)];
    let entry = bucket.find((e) => e.key === key);
    if (!entry) { entry = { key, ids: new Set() }; bucket.push(entry); }
    entry.ids.add(id);
  }

  get(key) {
    return this.#buckets[this.#hash(key)].find((e) => e.key === key)?.ids ?? new Set();
  }

  keys() { return this.#buckets.flatMap((b) => b.map((e) => e.key)); }

  // เดาคำ: ทุก key ที่ขึ้นต้นด้วย prefix
  guess(prefix) {
    const result = new Set();
    for (const key of this.keys()) {
      if (key.startsWith(prefix)) this.get(key).forEach((id) => result.add(id));
    }
    return result;
  }
}

export function tokenize(text) {
  return String(text ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// entries: [{ id, text }]
export function buildSearchIndex(entries) {
  const table = new HashTable();
  entries.forEach(({ id, text }) => tokenize(text).forEach((token) => table.add(token, id)));
  return table;
}

// คืน Set ของ id ที่ตรงกับทุกคำใน query (exact ∪ prefix guess ต่อหนึ่งคำ, แล้ว AND ระหว่างคำ)
// ถ้า query ว่าง คืน null (= ไม่ต้องกรอง)
export function searchIndex(table, query) {
  const tokens = tokenize(query);
  if (!tokens.length) return null;
  let result = null;
  for (const token of tokens) {
    const hits = new Set([...table.get(token), ...table.guess(token)]);
    result = result ? new Set([...result].filter((id) => hits.has(id))) : hits;
    if (!result.size) break;
  }
  return result;
}

// ---------- Insertion Sort (stable, ไม่แก้ array เดิม) ----------
export function insertionSort(list, compare = (a, b) => a - b) {
  const arr = [...list];
  for (let i = 1; i < arr.length; i++) {
    const current = arr[i];
    let j = i - 1;
    while (j >= 0 && compare(arr[j], current) > 0) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = current;
  }
  return arr;
}

// ---------- Graph: Flow Navigate ----------
// key = หน้า/ส่วนประกอบต้นทาง, value = ปลายทางที่ไปได้ ('previous' = pop จาก Stack)
export const FLOW = {
  home: ['login', 'menu', 'catalog', 'cart', 'hpsort', 'orders'],
  login: ['home', 'previous'],
  catalog: ['home', 'menu', 'cart', 'orders', 'login'],
  menu: ['home', 'catalog', 'cart', 'orders', 'login'],
  cart: ['checkout'],
  checkout: ['previous', 'home', 'orders'],
  orders: ['home', 'catalog'],
  hpsort: ['previous', 'home'],
};

export function canNavigate(from, to) {
  return FLOW[from]?.includes(to) ?? false;
}
