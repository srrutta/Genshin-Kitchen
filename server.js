import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { NATIONS } from './src/data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const MENU_SOURCE = JSON.parse(fs.readFileSync(path.join(__dirname, 'menu.json'), 'utf8'));
const IMAGE_DIR = path.join(__dirname, 'genshin-food');
const DIST_DIR = path.join(__dirname, 'dist');

app.use(express.json({ limit: '100kb' }));
app.use('/images', express.static(IMAGE_DIR));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(DIST_DIR));

const nationId = (name) => Object.keys(NATIONS).find((id) => NATIONS[id].name.toLowerCase() === name.toLowerCase()) ?? 'other';
const slug = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const restaurantTypes = new Map([
  ["Angel's Share", 'cafe'],
  ["Pops Kai's Tea", 'cafe'],
  ['Puspa Café', 'cafe'],
  ["Jut's Spice Shop", 'cafe'],
  ['Café Lutece', 'cafe'],
  ['Kvasnik', 'cafe'],
  ['Lianfang Dim Sum', 'street'],
  ["Ryouko's Street Food", 'street'],
  ["Jahangir's Delights", 'street'],
  ["Azalai's Merchat", 'street'],
  ["Zakan's Street Bites", 'street'],
  ["Limppu's Cart", 'street'],
]);

const restaurantsById = new Map();
const dishes = [];

for (const item of MENU_SOURCE) {
  if (!item || !Number.isInteger(item.id) || !item.name || !item.restaurant || !item.nation) {
    throw new Error('menu.json contains a dish missing its id, name, restaurant, or nation');
  }
  const nation = nationId(item.nation);
  const restaurantId = `${nation}-${slug(item.restaurant)}`;
  if (!restaurantsById.has(restaurantId)) {
    restaurantsById.set(restaurantId, {
      id: restaurantId,
      name: item.restaurant,
      nation,
      type: restaurantTypes.get(item.restaurant) ?? 'restaurant',
      owner: item.owner ?? '',
      note: '',
      dishNames: [],
      coverImage: null,
    });
  }

  const imageExists = typeof item.image === 'string' && fs.existsSync(path.join(IMAGE_DIR, path.basename(item.image)));
  const dish = {
    id: item.id,
    name: item.name,
    price: Number(item.price),
    image: imageExists ? `/images/${encodeURIComponent(path.basename(item.image))}` : null,
    category: item.type === 'Drink' ? 'drink' : item.type === 'Dessert' ? 'sweet' : 'main',
    effect: item.effect ?? null,
    effectDescription: item.effectDescription ?? item.description ?? null,
    ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
    restaurantId,
    restaurantName: item.restaurant,
    nation,
  };
  if (!Number.isFinite(dish.price) || dish.price < 0) throw new Error(`Invalid price for menu item ${item.id}`);
  dishes.push(dish);

  const restaurant = restaurantsById.get(restaurantId);
  restaurant.dishNames.push(dish.name);
  if (!restaurant.coverImage && dish.image) restaurant.coverImage = dish.image;
}

const restaurants = [...restaurantsById.values()];
const dishesByRestaurant = new Map(
  restaurants.map((restaurant) => [restaurant.id, dishes.filter((dish) => dish.restaurantId === restaurant.id)]),
);
const menuOfDay = new Map();
const MENU_TTL = 5 * 60 * 1000;
const STAGE_SECONDS = { Pending: 20, Accepted: 10, Preparing: 25 };
const orders = new Map();

function pickMenuOfDay(restaurantId) {
  const date = new Date().toISOString().slice(0, 10);
  const key = `${date}:${restaurantId}`;
  const cached = menuOfDay.get(key);
  if (cached && Date.now() - cached.at < MENU_TTL) return cached.items;

  const pool = [...(dishesByRestaurant.get(restaurantId) ?? [])];
  let seed = 0;
  for (const char of key) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const items = [];
  while (items.length < 3 && pool.length) items.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  menuOfDay.set(key, { at: Date.now(), items });
  return items;
}

export function getOrderStatus(order, now = Date.now()) {
  if (order.cancelledAt) return 'Cancelled';
  const elapsed = Math.max(0, (now - order.createdAt) / 1000);
  const pendingEnd = STAGE_SECONDS.Pending;
  const acceptedEnd = pendingEnd + STAGE_SECONDS.Accepted;
  const preparingEnd = acceptedEnd + STAGE_SECONDS.Preparing;
  const finishAt = (preparingEnd + order.eta) * 1000 + order.createdAt;
  if (elapsed < pendingEnd) return 'Pending';
  if (elapsed < acceptedEnd) return 'Accepted';
  if (elapsed < preparingEnd) return 'Preparing';
  if (now < finishAt) return 'Leading';
  return 'Completed';
}

function withOrderStatus(order, now = Date.now()) {
  const status = getOrderStatus(order, now);
  return { ...order, status, cancelable: status === 'Pending' || status === 'Accepted' };
}

function insertionSortByPrice(items) {
  const sorted = [...items];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    let j = i - 1;
    while (j >= 0 && sorted[j].price > current.price) {
      sorted[j + 1] = sorted[j];
      j--;
    }
    sorted[j + 1] = current;
  }
  return sorted;
}

app.get('/', (req, res) => {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) return res.status(503).send('Build the frontend with npm run build first.');
  return res.sendFile(indexPath);
});

app.get('/api/restaurants', (req, res) => {
  const query = String(req.query.search ?? '').trim().toLowerCase();
  const nation = String(req.query.nation ?? '');
  const type = String(req.query.type ?? '');
  const result = restaurants.filter((restaurant) =>
    (!nation || restaurant.nation === nation)
    && (!type || restaurant.type === type)
    && (!query || `${restaurant.name} ${restaurant.nation} ${restaurant.dishNames.join(' ')}`.toLowerCase().includes(query)));
  res.json({ restaurants: result });
});

app.get('/api/menu', (req, res) => {
  res.json({ items: dishes, count: dishes.length });
});

app.get('/api/restaurants/:id/menu', (req, res) => {
  const restaurant = restaurantsById.get(req.params.id);
  if (!restaurant) return res.status(404).json({ error: 'ไม่พบร้านอาหารนี้' });
  const restaurantDishes = dishesByRestaurant.get(restaurant.id) ?? [];
  return res.json({ restaurant, dishes: restaurantDishes, menuOfDay: pickMenuOfDay(restaurant.id) });
});

app.post('/api/login', (req, res) => {
  const { uid, nation, address } = req.body ?? {};
  if (!/^\d{4}$/.test(String(uid ?? '')) || !NATIONS[nation] || !NATIONS[nation].landmarks.includes(address)) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ (UID 4 ตัวท้าย, Nation, Address)' });
  }
  return res.json({ uid, nation, address });
});

app.get('/api/orders', (req, res) => {
  const uid = String(req.query.uid ?? '');
  if (!/^\d{4}$/.test(uid)) return res.status(400).json({ error: 'กรุณาระบุ UID 4 ตัวท้าย' });
  const userOrders = [...orders.values()]
    .filter((order) => order.uid === uid)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((order) => withOrderStatus(order));
  return res.json({ orders: userOrders });
});

app.get('/api/orders/:id', (req, res) => {
  const uid = String(req.query.uid ?? '');
  const order = orders.get(req.params.id);
  if (!order || order.uid !== uid) return res.status(404).json({ error: 'ไม่พบออเดอร์นี้' });
  return res.json({ order: withOrderStatus(order) });
});

app.post('/api/orders', (req, res) => {
  const { uid, nation, restaurantId, method, items } = req.body ?? {};
  if (!/^\d{4}$/.test(String(uid ?? '')) || !NATIONS[nation]) {
    return res.status(400).json({ error: 'กรุณาเข้าสู่ระบบก่อนยืนยันออเดอร์' });
  }
  if (!['bank', 'promptpay', 'cod'].includes(method)) {
    return res.status(400).json({ error: 'กรุณาเลือกช่องทางชำระเงิน' });
  }
  const restaurant = restaurantsById.get(restaurantId);
  if (!restaurant) return res.status(404).json({ error: 'ไม่พบร้านอาหารนี้' });
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return res.status(400).json({ error: 'รายการอาหารไม่ถูกต้อง' });
  }

  const available = new Map((dishesByRestaurant.get(restaurantId) ?? []).map((dish) => [dish.id, dish]));
  const normalizedItems = [];
  const seen = new Set();
  for (const line of items) {
    const dish = available.get(Number(line?.id));
    const qty = Number(line?.qty);
    if (!dish) return res.status(404).json({ error: 'ไม่พบเมนูอาหารนี้ในร้านที่เลือก' });
    if (!Number.isInteger(qty) || qty < 1 || qty > 99 || seen.has(dish.id)) {
      return res.status(400).json({ error: 'จำนวนจานต้องอยู่ระหว่าง 1 ถึง 99 และห้ามส่งเมนูซ้ำ' });
    }
    seen.add(dish.id);
    normalizedItems.push({ id: dish.id, name: dish.name, price: dish.price, image: dish.image, qty });
  }

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const sameNation = restaurant.nation === nation;
  const deliveryFee = sameNation ? 10 : 30;
  const eta = sameNation ? 15 : 40;
  const order = {
    id: crypto.randomUUID(),
    uid,
    restaurantId,
    restaurantName: restaurant.name,
    items: normalizedItems,
    subtotal,
    deliveryFee,
    eta,
    total: subtotal + deliveryFee,
    method,
    createdAt: Date.now(),
    cancelledAt: null,
  };
  orders.set(order.id, order);
  return res.status(201).json({ order: withOrderStatus(order) });
});

app.patch('/api/orders/:id/cancel', (req, res) => {
  const uid = String(req.body?.uid ?? '');
  const order = orders.get(req.params.id);
  if (!order || order.uid !== uid) return res.status(404).json({ error: 'ไม่พบออเดอร์นี้' });
  const current = withOrderStatus(order);
  if (!current.cancelable) {
    return res.status(409).json({ error: 'ยกเลิกไม่ได้ ออเดอร์เข้าสู่ขั้นตอนถัดไปแล้ว', order: current });
  }
  order.cancelledAt = Date.now();
  return res.json({ order: withOrderStatus(order) });
});

app.get('/menu', (req, res) => {
  const algorithm = req.query.sort || 'selection';
  const sorted = algorithm === 'insertion' ? insertionSortByPrice(dishes) : [...dishes].sort((a, b) => b.price - a.price);
  return res.json({ algorithm, count: sorted.length, data: sorted });
});

const orderQueue = [];
const history = [];
let historyId = 0;
const recordHistory = (entry) => history.push({ ...entry, historyId: `history-${Date.now()}-${++historyId}` });

app.get('/orders', (req, res) => {
  res.json({ items: orderQueue, size: orderQueue.length, cookingNext: orderQueue[0] ?? null });
});

app.post('/orders/batch', (req, res) => {
  const uid = String(req.body?.uid ?? '').replace(/\D/g, '').slice(-4);
  if (!/^\d{4}$/.test(uid)) return res.status(400).json({ error: 'กรุณากรอก UID 4 ตัวท้ายก่อนยืนยันออเดอร์' });
  if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
    return res.status(400).json({ error: 'ไม่มีอาหารในใบเสร็จ' });
  }

  const receiptId = String(req.body.receiptId || `receipt-${Date.now()}-${crypto.randomUUID()}`).slice(0, 100);
  const receiptItems = [];
  for (const line of req.body.items) {
    const food = dishes.find((dish) => dish.id === Number(line?.id));
    const quantity = Number(line?.quantity);
    if (!food) return res.status(404).json({ error: 'ไม่พบเมนูอาหารนี้' });
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return res.status(400).json({ error: 'จำนวนจานต้องอยู่ระหว่าง 1 ถึง 99' });
    }
    for (let plate = 0; plate < quantity; plate++) receiptItems.push({ ...food, uid, receiptId });
  }
  orderQueue.push(...receiptItems);
  recordHistory({ action: 'ADD_ORDER', item: receiptItems[0], items: receiptItems, receiptId, quantity: receiptItems.length });
  return res.status(201).json({ message: `เพิ่ม ${receiptItems.length} จานของ UID ${uid} เข้าคิวแล้ว`, size: orderQueue.length, receiptId });
});

app.post('/orders', (req, res) => {
  const food = dishes.find((dish) => dish.id === Number(req.body?.id));
  if (!food) return res.status(404).json({ error: 'ไม่พบเมนูอาหารนี้' });
  const uid = String(req.body?.uid ?? '').replace(/\D/g, '').slice(-4);
  if (!/^\d{4}$/.test(uid)) return res.status(400).json({ error: 'กรุณากรอก UID 4 ตัวท้ายก่อนยืนยันออเดอร์' });
  const receiptId = String(req.body.receiptId || `receipt-${Date.now()}-${crypto.randomUUID()}`).slice(0, 100);
  const orderItem = { ...food, uid, receiptId, orderTime: new Date().toLocaleTimeString('th-TH') };
  orderQueue.push(orderItem);
  recordHistory({ action: 'ADD_ORDER', item: orderItem, items: [orderItem], receiptId, quantity: 1 });
  return res.status(201).json({ message: `เพิ่มจานของ UID ${uid} เข้าคิวแล้ว`, size: orderQueue.length });
});

app.delete('/orders/process', (req, res) => {
  if (!orderQueue.length) return res.status(400).json({ error: 'ไม่มีออเดอร์ค้างอยู่' });
  const firstItem = orderQueue[0];
  const servedItems = firstItem.receiptId
    ? orderQueue.splice(0, orderQueue.findIndex((item) => item.receiptId !== firstItem.receiptId) < 0
      ? orderQueue.length
      : orderQueue.findIndex((item) => item.receiptId !== firstItem.receiptId))
    : orderQueue.splice(0, 1);
  recordHistory({ action: 'SERVE_ORDER', item: servedItems[0], items: servedItems, receiptId: firstItem.receiptId, quantity: servedItems.length });
  return res.json({ message: `เสิร์ฟ ${servedItems.length} จานของ UID ${firstItem.uid || 'ไม่ระบุ'} เรียบร้อย`, size: orderQueue.length });
});

app.delete('/orders/receipt/:receiptId', (req, res) => {
  const queueIndex = orderQueue.findIndex((item) => item.receiptId === req.params.receiptId);
  if (queueIndex < 0) return res.status(404).json({ error: 'ไม่พบออเดอร์นี้ในคิว' });
  const removedItems = orderQueue.filter((item) => item.receiptId === req.params.receiptId);
  for (let i = orderQueue.length - 1; i >= 0; i--) {
    if (orderQueue[i].receiptId === req.params.receiptId) orderQueue.splice(i, 1);
  }
  recordHistory({ action: 'CANCEL_ORDER', item: removedItems[0], items: removedItems, receiptId: req.params.receiptId, quantity: removedItems.length, queueIndex });
  return res.json({ message: `ยกเลิก ${removedItems.length} จานของ UID ${removedItems[0].uid || 'ไม่ระบุ'} แล้ว`, size: orderQueue.length });
});

app.get('/history', (req, res) => {
  res.json({ history: [...history].reverse(), size: history.length });
});

app.delete('/history/:id', (req, res) => {
  const index = history.findIndex((entry) => entry.historyId === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'ไม่พบรายการประวัตินี้' });
  history.splice(index, 1);
  return res.json({ message: 'ลบรายการประวัติแล้ว', size: history.length });
});

app.post('/undo', (req, res) => {
  const last = history.pop();
  if (!last) return res.status(400).json({ error: 'ไม่มีอะไรให้ย้อนกลับ' });
  const entries = last.items?.length ? last.items : [last.item];
  if (last.action === 'ADD_ORDER') {
    for (let i = orderQueue.length - 1; i >= 0; i--) {
      if (orderQueue[i].receiptId === last.receiptId) orderQueue.splice(i, 1);
    }
  } else if (last.action === 'SERVE_ORDER') {
    orderQueue.unshift(...entries);
  } else if (last.action === 'CANCEL_ORDER') {
    orderQueue.splice(Math.min(last.queueIndex, orderQueue.length), 0, ...entries);
  }
  return res.json({ message: 'ย้อนกลับรายการล่าสุดแล้ว', size: orderQueue.length });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number(err.status) || 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({ error: status === 500 ? 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' : err.message });
});

app.use((req, res) => res.status(404).json({ error: 'ไม่พบ endpoint นี้' }));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => console.log(`Teyvat Kitchen API running at http://localhost:${PORT}`));
}

export default app;
