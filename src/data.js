export const NATION_ORDER = ['mondstadt', 'liyue', 'inazuma', 'sumeru', 'fontaine', 'natlan', 'nodkrai', 'snezhnaya'];

export const NATIONS = {
  mondstadt: { name: 'Mondstadt', landmarks: ['Mondstadt City', 'Springvale', 'Dawn Winery', 'Dornman Port'] },
  liyue: { name: 'Liyue', landmarks: ['Liyue Harbor', 'Qingce Village', 'Qiaoying Village', 'Wangshu Inn', 'Mingyun Village', 'Yilong Wharf'] },
  inazuma: { name: 'Inazuma', landmarks: ['Inazuma City', 'Ritou', 'Kando Village', 'Bourou Village', 'Kujou Encampment', 'Higi Village'] },
  sumeru: { name: 'Sumeru', landmarks: ['Sumeru City', 'Aaru Village', 'Gandharva Ville', 'Port Ormos', 'Vimara Village', 'Caravan Ribat', 'Bayda Harbor'] },
  fontaine: { name: 'Fontaine', landmarks: ['Court of Fontaine', 'Merusee Village', 'Poisson', 'Petrichor City', 'Fontaine Research Istitue of Kinetic Energy Engineering', 'Lumidouce Port'] },
  natlan: { name: 'Natlan', landmarks: ['Stadium of the Sacred Flame', 'Children of Echoes', 'People of the Springs', 'Scions of the Canopy', 'Masters of the Night Wind', 'Flower Feather Clan', 'Collective of Plenty', 'Easybreeze Merket', 'Brewblossom Stores', 'Wavey Bay', 'Villa Guiztil'] },
  nodkrai: { name: 'NodKrai', landmarks: ['Nasha Town', 'Rossum Workshop', 'Mimisbrunr Books', 'Curutarium of Secrets', 'Speranza', 'Voynich Giuld', 'Krumkake Craftshop', 'Blue Amber Lake', 'Frostmoon Enclave', 'Kuuvahki Experimental Design Bereau', 'Final Night Cemetery']},
  snezhnaya: { name: 'Snezhnaya', landmarks: ['Zapolyary Palace', 'Adventurer\'s Guild', 'Central Station', 'The Korolevskiy Theater', 'Torchlight Books', 'Morepesok', 'Svetloledovka', 'Sretomorozsk', 'Glupov', 'Huntsman\'s Cabin', 'House of Hesperides', 'Pale Crown Palace'] },
};

export const TYPES = {
  restaurant: { label: 'restaurant' },
  street: { label: 'street food stalls' },
  cafe: { label: 'shop & cafe' },
};

export const CATEGORIES = [
  { id: 'main', label: 'Main', icon: '🍽️' },
  { id: 'dessert', label: 'Dessert', icon: '🍰' },
  { id: 'drink', label: 'Drink', icon: '🥤' },
];

export const EFFECTS = [
  { id: 'recovery', label: 'Recovery', icon: '➕' },
  { id: 'def', label: 'DEF', icon: '🛡️' },
  { id: 'adventurer', label: "Adventurer's", icon: '💪' },
  { id: 'atk', label: 'ATK', icon: '🗡️' },
];

export const DELIVERY = {
  same: { fee: 10, eta: 15 },
  other: { fee: 30, eta: 40 },
};

export function deliveryInfo(restaurantNation, userNation) {
  return restaurantNation === userNation ? DELIVERY.same : DELIVERY.other;
}

async function requestJSON(url, { signal, ...options } = {}) {
  const response = await fetch(url, {
    ...options,
    signal,
    headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('เซิร์ฟเวอร์ส่งข้อมูลที่ไม่ถูกต้อง');
  }
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function fetchRestaurants({ signal } = {}) {
  const { restaurants } = await requestJSON('/api/restaurants', { signal });
  return restaurants;
}

export async function fetchAllMenu({ signal } = {}) {
  const { items } = await requestJSON('/api/menu', { signal });
  return items;
}

export async function fetchMenu(restaurantId, { signal } = {}) {
  return requestJSON(`/api/restaurants/${encodeURIComponent(restaurantId)}/menu`, { signal });
}

export async function findUnavailable(restaurantId, ids) {
  const { dishes } = await fetchMenu(restaurantId);
  const available = new Set(dishes.map((dish) => dish.id));
  return ids.filter((id) => !available.has(id));
}

export function loginRequest(profile) {
  return requestJSON('/api/login', {
    method: 'POST',
    body: JSON.stringify(profile),
  });
}

export async function fetchOrders(uid, { signal } = {}) {
  const { orders } = await requestJSON(`/api/orders?uid=${encodeURIComponent(uid)}`, { signal });
  return orders;
}

export function createOrder(order) {
  return requestJSON('/api/orders', {
    method: 'POST',
    body: JSON.stringify(order),
  });
}

export function cancelOrder(id, uid) {
  return requestJSON(`/api/orders/${encodeURIComponent(id)}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ uid }),
  });
}

export const ORDER_STATUS = {
  Pending: { label: 'Pending', th: 'รอร้านรับออเดอร์', icon: '⏳', cancelable: true },
  Accepted: { label: 'Accepted', th: 'ร้านรับออเดอร์แล้ว', icon: '✅', cancelable: true },
  Preparing: { label: 'Preparing', th: 'กำลังเตรียมอาหาร', icon: '🍳', cancelable: false },
  Leading: { label: 'Leading', th: 'กำลังนำส่ง', icon: '🛵', cancelable: false },
  Completed: { label: 'Completed', th: 'เสร็จสิ้น', icon: '🎉', cancelable: false },
  Cancelled: { label: 'Cancelled', th: 'ยกเลิกแล้ว', icon: '❌', cancelable: false },
};

export const STATUS_FLOW = ['Pending', 'Accepted', 'Preparing', 'Leading', 'Completed'];
export const STAGE_SECONDS = { Pending: 20, Accepted: 10, Preparing: 25 };

export const orderTotalSeconds = (order) =>
  STAGE_SECONDS.Pending + STAGE_SECONDS.Accepted + STAGE_SECONDS.Preparing + order.eta;

export const orderFinishAt = (order) => order.createdAt + orderTotalSeconds(order) * 1000;

export const isOrderActive = (order) => order.status !== 'Completed' && order.status !== 'Cancelled';

export const formatMora = (amount) => `${Number(amount || 0).toLocaleString()} Mora`;
