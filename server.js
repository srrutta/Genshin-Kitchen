const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'genshin-food')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function hasUpstashRedis(){
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

app.use((req, res, next) => {
  const orderStateRoute = req.path.startsWith('/orders') || req.path === '/history' || req.path.startsWith('/history/') || req.path === '/undo';
  if(process.env.VERCEL && orderStateRoute && !hasUpstashRedis()){
    return res.status(503).json({ error: 'ตั้งค่า UPSTASH_REDIS_REST_URL และ UPSTASH_REDIS_REST_TOKEN ใน Vercel ก่อนใช้งานคิวและประวัติ' });
  }
  next();
});

// ---------------------------------------------------------------------
// TODO 1 — โหลดเมนูจาก menu.json ก่อนเพื่อใช้ Nation/รูป/วัตถุดิบครบ แล้วใช้ API เป็น fallback
// แหล่งข้อมูล: genshin-db-api (https://github.com/theBowja/genshin-db-api)
//   -> ดึงรายการ "อาหาร" (food) ทั้งหมดจากเกม Genshin Impact มาทำเป็นเมนู
// ---------------------------------------------------------------------
const API_URL = 'https://genshin-db-api.vercel.app/api/v5/foods?query=names&matchCategories=true&verboseCategories=true';
let menuItems = [];

// menu.json มีข้อมูลเมือง (nation) ร้านอาหาร (restaurant) และวัตถุดิบ (ingredients)
// ของแต่ละจานอยู่แล้ว แต่ข้อมูลจาก genshin-db-api ภายนอกไม่มี 3 ฟิลด์นี้
// จึงใช้ตารางนี้เติมให้โดยอ้างอิงชื่อจาน ถ้าไม่พบในตารางจะตกไปกลุ่ม "อื่นๆ"
// (Teyvat Kitchen) และไม่มีวัตถุดิบให้แสดง
const DISH_FALLBACK = {
  'Jueyun Guoba':            { nation: 'liyue',     restaurant: 'Wanmin Restaurant',    ingredients: ['Jueyun Chili', 'Flour', 'Sugar'] },
  'Sweet Madame':            { nation: 'liyue',     restaurant: 'Wanmin Restaurant',    ingredients: ['Flour', 'Jueyun Chili', 'Raw Meat'] },
  'Mondstadt Hash Brown':    { nation: 'mondstadt', restaurant: 'Good Hunter',          ingredients: ['Potato', 'Flour', 'Butter'] },
  'Northern Smoked Chicken': { nation: 'mondstadt', restaurant: 'Good Hunter',          ingredients: ['Raw Meat', 'Spice', 'Salt'] },
  'Almond Tofu':             { nation: 'liyue',     restaurant: 'Liuli Pavilion',       ingredients: ['Milk', 'Sugar', 'Almond'] },
  'Sunset Fried Rice':       { nation: 'liyue',     restaurant: 'Wanmin Restaurant',    ingredients: ['Rice', 'Sunsettia', 'Bird Egg'] },
  'Teyvat Fried Egg':        { nation: 'mondstadt', restaurant: 'Good Hunter',          ingredients: ['Bird Egg', 'Butter', 'Salt'] },
  'Moon Pie':                { nation: 'liyue',     restaurant: 'Liuli Pavilion',       ingredients: ['Flour', 'Sugar', 'Milk'] },
  'Stir-Fried Shrimp':       { nation: 'liyue',     restaurant: 'Liuli Pavilion',       ingredients: ['Shrimp Meat', 'Onion', 'Pepper'] },
  'Calla Lily Seafood Soup': { nation: 'inazuma',   restaurant: 'Komore Teahouse',      ingredients: ['Fish', 'Calla Lily', 'Seagrass'] },
  'Cold Cut Platter':        { nation: 'mondstadt', restaurant: "Angel's Share",        ingredients: ['Raw Meat', 'Cheese', 'Onion'] },
  'Tandoori Roast Chicken':  { nation: 'sumeru',    restaurant: 'Aaru Village Kitchen', ingredients: ['Raw Meat', 'Spice', 'Pepper'] },
  'Crystal Shrimp':          { nation: 'liyue',     restaurant: 'Wanmin Restaurant',    ingredients: ['Shrimp Meat', 'Seagrass', 'Bird Egg'] },
  "Fisherman's Toast":       { nation: 'mondstadt', restaurant: 'Good Hunter',          ingredients: ['Flour', 'Butter', 'Cheese'] },
  'Golden Crab':             { nation: 'liyue',     restaurant: 'Liuli Pavilion',       ingredients: ['Crab', 'Butter', 'Sunsettia'] },
  'Jasmine Braised Lamb':    { nation: 'sumeru',    restaurant: 'Aaru Village Kitchen', ingredients: ['Raw Meat', 'Spice', 'Fermented Juice'] },
  'Streusel-Crusted Meat':   { nation: 'mondstadt', restaurant: "Angel's Share",        ingredients: ['Raw Meat', 'Flour', 'Sugar'] },
  'Universal Peace':         { nation: 'liyue',     restaurant: 'Wanmin Restaurant',    ingredients: ['Fish', 'Crab', 'Shrimp Meat'] },
  "Adeptus' Temptation":     { nation: 'liyue',     restaurant: 'Liuli Pavilion',       ingredients: ['Fish', 'Spice', 'Sunsettia'] },
  'Berry and Mint Burst':    { nation: 'mondstadt', restaurant: "Angel's Share",        ingredients: ['Valberry', 'Mint', 'Sugar'] },
};

function enrichDish(item) {
  const fb = DISH_FALLBACK[item.name] || {};
  return {
    ...item,
    nation: item.nation || fb.nation || 'other',
    restaurant: item.restaurant || fb.restaurant || 'Teyvat Kitchen',
    ingredients: (item.ingredients && item.ingredients.length) ? item.ingredients : (fb.ingredients || []),
  };
}

// genshin-db เปลี่ยนชื่อ field ไปมาในแต่ละเวอร์ชัน (เช่น rarity/qualityType,
// effect/description) จึงใช้ฟังก์ชันนี้เลือก field ที่มีจริงแบบยืดหยุ่น
// แทนที่จะอิงชื่อ field ตายตัวชื่อเดียว
function findImageUrl(images) {
  if (!images || typeof images !== 'object') return null;
  const preferredKeys = ['icon', 'card', 'itemIcon', 'nameicon', 'filename_icon', 'portrait'];
  for (const key of preferredKeys) {
    const v = images[key];
    if (typeof v === 'string' && v.startsWith('http')) return v;
  }
  for (const v of Object.values(images)) {
    if (typeof v === 'string' && v.startsWith('http')) return v;
  }
  return null;
}

function normalizeFood(item, idx) {
  const rarity = Number(item.rarity ?? item.rarityType ?? item.qualityType ?? 1) || 1;
  return enrichDish({
    id: item.id ?? idx + 1,
    name: item.name,
    rarity,
    price: rarity * 5000, // ไม่มีราคาจริงในเกม จึงสมมติราคาเป็น Mora ตามระดับความหายาก (rarity)
    image: findImageUrl(item.images) || (typeof item.image === 'string' ? item.image : null),
  });
}

async function loadMenu() {
  try {
    const fileData = fs.readFileSync(path.join(__dirname, 'menu.json'), 'utf8');
    const localMenu = JSON.parse(fileData);
    if (!Array.isArray(localMenu) || !localMenu.length) throw new Error('menu.json ไม่มีข้อมูลเมนู');
    menuItems = localMenu.map(enrichDish);
    console.log(`✅ โหลดเมนูจาก menu.json สำเร็จ: ${menuItems.length} เมนู`);
    return;
  } catch (err) {
    console.log(`⚠️ โหลด menu.json ไม่สำเร็จ (${err.message}) -> กำลังลอง API ภายนอก`);
  }

  try {
    const res = await fetch(API_URL);

    // ดัก Error กรณี API ส่งหน้า HTML กลับมาแทน JSON
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("API ตอบกลับมาเป็น HTML (อาจจะติดบล็อกของมหาลัยหรือเน็ตมีปัญหา)");
    }

    if (!res.ok) throw new Error('Status: ' + res.status);

    const data = await res.json();

    // ปกติ query=names + matchCategories + verboseCategories จะได้ array ของ
    // ออบเจ็กต์อาหารตรง ๆ แต่บาง option (เช่น dumpResult) จะห่อมาใน { result: [...] }
    const rawList = Array.isArray(data) ? data : (Array.isArray(data.result) ? data.result : []);
    if (!rawList.length) throw new Error('API ส่งข้อมูลว่างกลับมา');

    menuItems = rawList
      .filter(item => item && item.name)
      .slice(0, 30) // จำกัดจำนวนเมนูไม่ให้เยอะเกินไป (genshin-db มีอาหารเป็นร้อยรายการ)
      .map((item, idx) => normalizeFood(item, idx));

    console.log(`✅ โหลดเมนูอาหาร (Genshin Impact) จาก API ภายนอกสำเร็จ: ${menuItems.length} เมนู`);

  } catch (err) {
    // FALLBACK: สลับมาใช้ไฟล์ Local หากเน็ตพังหรือ API ล่ม
    console.log(`⚠️ ไม่สามารถดึง API ได้ (${err.message}) -> กำลังสลับไปใช้ Local File`);
    try {
      const fileData = fs.readFileSync(path.join(__dirname, 'menu.json'), 'utf8');
      menuItems = JSON.parse(fileData).map(enrichDish);
      console.log(`✅ โหลดเมนูจาก menu.json สำเร็จ: ${menuItems.length} เมนู`);
    } catch (fileErr) {
      console.error(`❌ ไม่พบไฟล์ menu.json กรุณาสร้างไฟล์นี้ไว้ในโฟลเดอร์เดียวกัน`);
    }
  }
}

// ---------------------------------------------------------------------
// TODO 2 — Sort (Insertion: น้อยไปมาก, Selection/Bubble: มากไปน้อย)
// ---------------------------------------------------------------------
function selectionSort(arr) {
  const a = [...arr];
  for (let i = 0; i < a.length - 1; i++) {
    let maxIdx = i;
    for (let j = i + 1; j < a.length; j++) {
      if (a[j].price > a[maxIdx].price) maxIdx = j;
    }
    [a[i], a[maxIdx]] = [a[maxIdx], a[i]];
  }
  return a;
}

function insertionSort(arr) {
  const a = [...arr];
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    let j = i - 1;
    while (j >= 0 && a[j].price > key.price) {
      a[j + 1] = a[j];
      j--;
    }
    a[j + 1] = key;
  }
  return a;
}

function bubbleSort(arr) {
  const a = [...arr];
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < a.length - 1 - i; j++) {
      if (a[j].price < a[j + 1].price) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
      }
    }
  }
  return a;
}

// ---------------------------------------------------------------------
// Endpoint พิสูจน์ว่ามีการดึง API ภายนอกจริง (genshin-db-api)
// ไม่แตะ menuItems ที่หน้าเว็บใช้อยู่เลย ใช้แค่ดูผล/debug/แสดงเป็นหลักฐาน
// ---------------------------------------------------------------------
app.get('/menu/sync-preview', async (req, res) => {
  const fetchedAt = new Date().toISOString();
  try {
    const apiRes = await fetch(API_URL);

    const contentType = apiRes.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('API ตอบกลับมาเป็น HTML (อาจจะติดบล็อกของมหาลัยหรือเน็ตมีปัญหา)');
    }
    if (!apiRes.ok) throw new Error('Status: ' + apiRes.status);

    const data = await apiRes.json();
    const rawList = Array.isArray(data) ? data : (Array.isArray(data.result) ? data.result : []);
    if (!rawList.length) throw new Error('API ส่งข้อมูลว่างกลับมา');

    const items = rawList
      .filter(item => item && item.name)
      .slice(0, 30)
      .map((item, idx) => normalizeFood(item, idx));

    res.json({
      source: 'genshin-db-api',
      url: API_URL,
      fetchedAt,
      success: true,
      count: items.length,
      sample: items.slice(0, 5),
      items,
    });
  } catch (err) {
    res.status(502).json({
      source: 'genshin-db-api',
      url: API_URL,
      fetchedAt,
      success: false,
      error: err.message,
      count: 0,
      items: [],
    });
  }
});

// Endpoint ดึงเมนู
app.get('/menu', (req, res) => {
  const algo = req.query.sort || 'selection';

  let sorted;
  if (algo === 'insertion')   sorted = insertionSort(menuItems);
  else if (algo === 'bubble') sorted = bubbleSort(menuItems);
  else                        sorted = selectionSort(menuItems);

  res.json({ algorithm: algo, count: sorted.length, data: sorted });
});

// ---------------------------------------------------------------------
// TODO 3 — Queue (คิวออเดอร์ร้านอาหาร)
// ---------------------------------------------------------------------
class Queue {
  constructor() { this.items = []; }
  enqueue(item) { this.items.push(item); }       // รับออเดอร์
  dequeue()     { return this.items.shift(); }   // ทำเสร็จ เอาไปเสิร์ฟ
  peek()        { return this.items[0]; }
  size()        { return this.items.length; }
}

const orderQueue = new Queue();

const ORDER_STATE_KEY = 'teyvat-kitchen:order-state:v1';
const ORDER_STATE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
local state = raw and cjson.decode(raw) or { queue = cjson.decode('[]'), history = cjson.decode('[]') }
local operation = ARGV[1]
local payload = cjson.decode(ARGV[2] or '{}')

local function save(result)
  redis.call('SET', KEYS[1], cjson.encode(state))
  return cjson.encode(result)
end

if operation == 'read' then
  return cjson.encode(state)
elseif operation == 'enqueue' then
  for _, item in ipairs(payload.items) do table.insert(state.queue, item) end
  table.insert(state.history, payload.entry)
  return save({ size = #state.queue })
elseif operation == 'serve' then
  if #state.queue == 0 then return cjson.encode({ error = 'ไม่มีออเดอร์ค้างอยู่' }) end
  local first = state.queue[1]
  local receiptId = first.receiptId
  local served = cjson.decode('[]')
  while #state.queue > 0 do
    local item = state.queue[1]
    if #served > 0 and (not receiptId or item.receiptId ~= receiptId) then break end
    if #served == 0 and receiptId and item.receiptId ~= receiptId then break end
    table.insert(served, table.remove(state.queue, 1))
    if not receiptId then break end
  end
  local entry = payload.entry
  entry.item = served[1]
  entry.items = served
  entry.receiptId = receiptId
  entry.quantity = #served
  table.insert(state.history, entry)
  return save({ message = 'เสิร์ฟ ' .. tostring(#served) .. ' จานของ UID ' .. tostring(first.uid or 'ไม่ระบุ') .. ' เรียบร้อย', size = #state.queue })
elseif operation == 'cancel' then
  local removed = cjson.decode('[]')
  local kept = cjson.decode('[]')
  local queueIndex = nil
  for index, item in ipairs(state.queue) do
    if item.receiptId == payload.receiptId then
      if not queueIndex then queueIndex = index - 1 end
      table.insert(removed, item)
    else
      table.insert(kept, item)
    end
  end
  if #removed == 0 then return cjson.encode({ error = 'ไม่พบออเดอร์นี้ในคิว' }) end
  state.queue = kept
  local entry = payload.entry
  entry.item = removed[1]
  entry.items = removed
  entry.receiptId = payload.receiptId
  entry.quantity = #removed
  entry.queueIndex = queueIndex
  table.insert(state.history, entry)
  return save({ message = 'ยกเลิก ' .. tostring(#removed) .. ' จานของ UID ' .. tostring(removed[1].uid or 'ไม่ระบุ') .. ' แล้ว', size = #state.queue })
elseif operation == 'delete-history' then
  local kept = cjson.decode('[]')
  local found = false
  for _, entry in ipairs(state.history) do
    if entry.historyId == payload.historyId then found = true else table.insert(kept, entry) end
  end
  if not found then return cjson.encode({ error = 'ไม่พบรายการประวัตินี้' }) end
  state.history = kept
  return save({ message = 'ลบรายการประวัติแล้ว', size = #state.history })
elseif operation == 'undo' then
  if #state.history == 0 then return cjson.encode({ error = 'ไม่มีอะไรให้ย้อนกลับ' }) end
  local last = table.remove(state.history)
  local restored = last.items or { last.item }
  local count = #restored
  if last.action == 'ADD_ORDER' then
    local kept = cjson.decode('[]')
    if last.receiptId then
      count = 0
      for _, item in ipairs(state.queue) do
        if item.receiptId == last.receiptId then count = count + 1 else table.insert(kept, item) end
      end
      state.queue = kept
    else
      if #state.queue > 0 then table.remove(state.queue) end
      count = 1
    end
  elseif last.action == 'SERVE_ORDER' then
    local queue = cjson.decode('[]')
    for _, item in ipairs(restored) do table.insert(queue, item) end
    for _, item in ipairs(state.queue) do table.insert(queue, item) end
    state.queue = queue
  elseif last.action == 'CANCEL_ORDER' then
    local queue = cjson.decode('[]')
    local queueIndex = math.max(0, math.min(tonumber(last.queueIndex) or 0, #state.queue))
    for index, item in ipairs(state.queue) do
      if index == queueIndex + 1 then
        for _, restoredItem in ipairs(restored) do table.insert(queue, restoredItem) end
      end
      table.insert(queue, item)
    end
    if queueIndex >= #state.queue then
      for _, restoredItem in ipairs(restored) do table.insert(queue, restoredItem) end
    end
    state.queue = queue
  end
  local message
  if last.action == 'ADD_ORDER' and last.receiptId then
    message = 'ยกเลิก ' .. tostring(count) .. ' จานของ UID ' .. tostring(last.item.uid or 'ไม่ระบุ') .. ' แล้ว'
  elseif last.action == 'CANCEL_ORDER' or last.action == 'SERVE_ORDER' then
    message = 'คืน ' .. tostring(count) .. ' จานของ UID ' .. tostring(last.item.uid or 'ไม่ระบุ') .. ' เข้าคิวแล้ว'
  else
    message = 'ยกเลิกการ ' .. tostring(last.action) .. ' ของ UID ' .. tostring(last.item.uid or 'ไม่ระบุ') .. ' แล้ว'
  end
  return save({ message = message, size = #state.queue })
end

return cjson.encode({ error = 'คำสั่งจัดการคิวไม่ถูกต้อง' })
`;

async function runUpstashOperation(operation, payload = {}){
  if(!hasUpstashRedis()) return null;
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['EVAL', ORDER_STATE_SCRIPT, '1', ORDER_STATE_KEY, operation, JSON.stringify(payload)]),
  });
  const result = await response.json();
  if(!response.ok || result.error) throw new Error(result.error || `Upstash ตอบกลับ ${response.status}`);
  return JSON.parse(result.result);
}

function createStoredHistoryEntry(action, item, items, receiptId, extra = {}){
  return { historyId: createHistoryId(), action, item, items, receiptId, quantity: items.length, ...extra };
}

function asyncRoute(handler){
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get('/orders', asyncRoute(async (req, res) => {
  const stored = await runUpstashOperation('read');
  if(stored) return res.json({ items: stored.queue, size: stored.queue.length, cookingNext: stored.queue[0] || null });
  res.json({ items: orderQueue.items, size: orderQueue.size(), cookingNext: orderQueue.peek() || null });
}));

app.post('/orders', asyncRoute(async (req, res) => {
  const food = menuItems.find(m => m.id === Number(req.body.id));
  if (!food) return res.status(404).json({ error: 'ไม่พบเมนูอาหารนี้' });
  const uid = String(req.body.uid || '').replace(/\D/g, '').slice(-4);
  if (!/^\d{4}$/.test(uid)) return res.status(400).json({ error: 'กรุณากรอก UID 4 ตัวท้ายก่อนยืนยันออเดอร์' });
  const receiptId = String(req.body.receiptId || `receipt-${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 100);

  const orderItem = { ...food, uid, ...(receiptId ? { receiptId } : {}), orderTime: new Date().toLocaleTimeString('th-TH') };
  const stored = await runUpstashOperation('enqueue', {
    items: [orderItem],
    entry: createStoredHistoryEntry('ADD_ORDER', orderItem, [orderItem], receiptId),
  });
  if(stored) return res.status(201).json({ message: `เพิ่มจานของ UID ${uid} เข้าคิวแล้ว`, size: stored.size });

  orderQueue.enqueue(orderItem);

  history.push({ action: 'ADD_ORDER', item: orderItem, items: [orderItem], receiptId, quantity: 1 });

  res.status(201).json({ message: `เพิ่มจานของ UID ${uid} เข้าคิวแล้ว`, size: orderQueue.size() });
}));

app.post('/orders/batch', asyncRoute(async (req, res) => {
  const uid = String(req.body.uid || '').replace(/\D/g, '').slice(-4);
  if (!/^\d{4}$/.test(uid)) return res.status(400).json({ error: 'กรุณากรอก UID 4 ตัวท้ายก่อนยืนยันออเดอร์' });
  if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
    return res.status(400).json({ error: 'ไม่มีอาหารในใบเสร็จ' });
  }

  const lines = [];
  for (const line of req.body.items) {
    const food = menuItems.find(item => item.id === Number(line?.id));
    const quantity = Number(line?.quantity);
    if (!food) return res.status(404).json({ error: 'ไม่พบเมนูอาหารนี้' });
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return res.status(400).json({ error: 'จำนวนจานต้องอยู่ระหว่าง 1 ถึง 99' });
    }
    lines.push({ food, quantity });
  }

  const receiptId = String(req.body.receiptId || `receipt-${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 100);
  const orderTime = new Date().toLocaleTimeString('th-TH');
  const receiptItems = [];
  for (const { food, quantity } of lines) {
    for (let plate = 0; plate < quantity; plate++) {
      const orderItem = { ...food, uid, receiptId, orderTime };
      receiptItems.push(orderItem);
    }
  }

  const stored = await runUpstashOperation('enqueue', {
    items: receiptItems,
    entry: createStoredHistoryEntry('ADD_ORDER', receiptItems[0], receiptItems, receiptId),
  });
  if(stored){
    return res.status(201).json({
      message: `เพิ่ม ${receiptItems.length} จานของ UID ${uid} เข้าคิวแล้ว`,
      size: stored.size,
      receiptId,
    });
  }

  receiptItems.forEach(orderItem => orderQueue.enqueue(orderItem));
  history.push({
    action: 'ADD_ORDER',
    item: receiptItems[0],
    items: receiptItems,
    receiptId,
    quantity: receiptItems.length,
  });

  res.status(201).json({
    message: `เพิ่ม ${receiptItems.length} จานของ UID ${uid} เข้าคิวแล้ว`,
    size: orderQueue.size(),
    receiptId,
  });
}));

app.delete('/orders/process', asyncRoute(async (req, res) => {
  const stored = await runUpstashOperation('serve', { entry: { historyId: createHistoryId(), action: 'SERVE_ORDER' } });
  if(stored){
    if(stored.error) return res.status(400).json({ error: stored.error });
    return res.json(stored);
  }
  if (orderQueue.size() === 0) return res.status(400).json({ error: 'ไม่มีออเดอร์ค้างอยู่' });

  const firstItem = orderQueue.peek();
  const receiptId = firstItem.receiptId;
  const servedItems = [];
  if (receiptId) {
    while (orderQueue.size() && orderQueue.peek().receiptId === receiptId) {
      servedItems.push(orderQueue.dequeue());
    }
  } else {
    servedItems.push(orderQueue.dequeue());
  }

  history.push({
    action: 'SERVE_ORDER',
    item: servedItems[0],
    items: servedItems,
    receiptId,
    quantity: servedItems.length,
  });

  res.json({ message: `เสิร์ฟ ${servedItems.length} จานของ UID ${firstItem.uid || 'ไม่ระบุ'} เรียบร้อย`, size: orderQueue.size() });
}));

app.delete('/orders/receipt/:receiptId', asyncRoute(async (req, res) => {
  const receiptId = req.params.receiptId;
  const stored = await runUpstashOperation('cancel', {
    receiptId,
    entry: { historyId: createHistoryId(), action: 'CANCEL_ORDER' },
  });
  if(stored){
    if(stored.error) return res.status(404).json({ error: stored.error });
    return res.json(stored);
  }
  const queueIndex = orderQueue.items.findIndex(item => item.receiptId === receiptId);
  if (queueIndex < 0) return res.status(404).json({ error: 'ไม่พบออเดอร์นี้ในคิว' });

  const removedItems = orderQueue.items.filter(item => item.receiptId === receiptId);
  orderQueue.items = orderQueue.items.filter(item => item.receiptId !== receiptId);
  history.push({
    action: 'CANCEL_ORDER',
    item: removedItems[0],
    items: removedItems,
    receiptId,
    quantity: removedItems.length,
    queueIndex,
  });

  res.json({ message: `ยกเลิก ${removedItems.length} จานของ UID ${removedItems[0].uid || 'ไม่ระบุ'} แล้ว`, size: orderQueue.size() });
}));

// ---------------------------------------------------------------------
// TODO 4 — Stack เก็บประวัติการจัดการออเดอร์ เพื่อทำระบบ Undo
// ---------------------------------------------------------------------
let historyIdSequence = 0;
function createHistoryId(){
  historyIdSequence += 1;
  return `history-${Date.now()}-${historyIdSequence}`;
}

class Stack {
  constructor() { this.items = []; }
  push(item)    { this.items.push({ ...item, historyId: item.historyId || createHistoryId() }); }
  pop()         { return this.items.pop(); }
  peek()        { return this.items[this.items.length - 1]; }
  isEmpty()     { return this.items.length === 0; }
  display()     { return [...this.items].reverse(); }
}

const history = new Stack();

if (process.env.ORDER_STATE_JSON) {
  try {
    const state = JSON.parse(process.env.ORDER_STATE_JSON);
    if (!Array.isArray(state.queue) || !Array.isArray(state.history)) throw new Error('Invalid Queue/Stack snapshot');
    orderQueue.items = state.queue;
    history.items = state.history.map(item => ({ ...item, historyId: item.historyId || createHistoryId() }));
    console.log(`✅ กู้คืน Queue ${state.queue.length} รายการ และ Stack ${state.history.length} รายการ`);
  } catch (err) {
    console.error(`⚠️ กู้คืนสถานะเดิมไม่สำเร็จ: ${err.message}`);
  }
  delete process.env.ORDER_STATE_JSON;
}

app.get('/history', asyncRoute(async (req, res) => {
  const stored = await runUpstashOperation('read');
  if(stored) return res.json({ history: stored.history.reverse(), size: stored.history.length });
  res.json({ history: history.display(), size: history.items.length });
}));

app.delete('/history/:historyId', asyncRoute(async (req, res) => {
  const stored = await runUpstashOperation('delete-history', { historyId: req.params.historyId });
  if(stored){
    if(stored.error) return res.status(404).json({ error: stored.error });
    return res.json(stored);
  }
  const index = history.items.findIndex(item => item.historyId === req.params.historyId);
  if (index < 0) return res.status(404).json({ error: 'ไม่พบรายการประวัตินี้' });

  history.items.splice(index, 1);
  res.json({ message: 'ลบรายการประวัติแล้ว', size: history.items.length });
}));

app.post('/undo', asyncRoute(async (req, res) => {
  const stored = await runUpstashOperation('undo');
  if(stored){
    if(stored.error) return res.status(400).json({ error: stored.error });
    return res.json(stored);
  }
  if (history.isEmpty()) return res.status(400).json({ error: 'ไม่มีอะไรให้ย้อนกลับ' });

  const last = history.pop();
  let removedCount = 0;

  if (last.action === 'ADD_ORDER') {
    if (last.item.receiptId) {
      removedCount = orderQueue.items.filter(item => item.receiptId === last.item.receiptId).length;
      orderQueue.items = orderQueue.items.filter(item => item.receiptId !== last.item.receiptId);
      history.items = history.items.filter(entry =>
        !(entry.action === 'ADD_ORDER' && entry.item.receiptId === last.item.receiptId)
      );
    } else {
      orderQueue.items.pop();
      removedCount = 1;
    }
  } else if (last.action === 'SERVE_ORDER') {
    const restoredItems = Array.isArray(last.items) && last.items.length ? last.items : [last.item];
    orderQueue.items.unshift(...restoredItems);
    removedCount = restoredItems.length;
  } else if (last.action === 'CANCEL_ORDER') {
    const restoredItems = Array.isArray(last.items) && last.items.length ? last.items : [last.item];
    const queueIndex = Math.min(Math.max(Number(last.queueIndex) || 0, 0), orderQueue.size());
    orderQueue.items.splice(queueIndex, 0, ...restoredItems);
    removedCount = restoredItems.length;
  }

  let message;
  if (last.action === 'ADD_ORDER' && last.item.receiptId) {
    message = `ยกเลิก ${removedCount} จานของ UID ${last.item.uid || 'ไม่ระบุ'} แล้ว`;
  } else if (last.action === 'SERVE_ORDER' && removedCount > 1) {
    message = `คืน ${removedCount} จานของ UID ${last.item.uid || 'ไม่ระบุ'} เข้าคิวแล้ว`;
  } else if (last.action === 'CANCEL_ORDER') {
    message = `คืน ${removedCount} จานของ UID ${last.item.uid || 'ไม่ระบุ'} เข้าคิวแล้ว`;
  } else {
    message = `ยกเลิกการ ${last.action} ของ UID ${last.item.uid || 'ไม่ระบุ'} แล้ว`;
  }
  res.json({ message, size: orderQueue.size() });
}));

app.use((err, req, res, next) => {
  console.error(`❌ Order state request failed: ${err.message}`);
  if(res.headersSent) return next(err);
  res.status(503).json({ error: 'เชื่อมต่อที่เก็บคิวและประวัติไม่สำเร็จ กรุณาลองอีกครั้ง' });
});

// ---------------------------------------------------------------------
// เริ่มโหลดเมนูทันที (ไม่ต้องรอ .then() ก่อน export — สำคัญสำหรับ Vercel serverless)
loadMenu();

// รันแบบ local server ปกติ (เช่น `node server.js` บนเครื่องตัวเอง)
// บน Vercel ตัว app.listen() นี้จะไม่ถูกใช้งาน (Vercel เรียก handler ผ่าน module.exports แทน)
if (require.main === module) {
  app.listen(PORT, () => console.log(`🍔 Food System Server running: http://localhost:${PORT}`));
}

// จำเป็นสำหรับ Vercel: ให้ @vercel/node ดึง Express app ไปใช้เป็น serverless function handler
module.exports = app;