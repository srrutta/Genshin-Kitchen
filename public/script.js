function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window._tt);
  window._tt = setTimeout(()=>t.classList.remove('show'), 2000);
}

async function api(path, options){
  const res = await fetch(path, options);
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`);
  return data;
}

// ---------------------------------------------------------------------
// ข้อมูลเมือง (nation) และร้านอาหาร (restaurant) สำหรับจัดกลุ่มแสดงผล
// ---------------------------------------------------------------------
const NATION_ORDER = ['mondstadt','liyue','inazuma','sumeru','fontaine','natlan','nodkrai','snezhnaya','other'];
const NATION_META = {
  mondstadt: { name: 'Mondstadt', color: '#c49a52' },
  liyue:     { name: 'Liyue',     color: '#b98a55' },
  inazuma:   { name: 'Inazuma',   color: '#8f7659' },
  sumeru:    { name: 'Sumeru',    color: '#81835e' },
  fontaine:  { name: 'Fontaine',  color: '#a58a68' },
  natlan:    { name: 'Natlan',    color: '#aa7351' },
  nodkrai:   { name: 'NodKrai',   color: '#8f8067' },
  snezhnaya: { name: 'Snezhnaya', color: '#96917d' },
  other:     { name: 'อื่นๆ',      color: '#978674' },
};
const RESTAURANT_META = {
  'Mondstadt|Good Hunter':          { owner: 'Owner: Sara',             note: 'โรงเตี๊ยมริมจัตุรัสสำหรับนักผจญภัย' },
  "Mondstadt|Angel's Share":        { owner: 'Owner: Diluc',            note: 'บาร์ขึ้นชื่อ บรรยากาศคลาสสิค' },
  'Liyue|Wanmin Restaurant':        { owner: 'Owner: Chef Mao',         note: 'ร้านอาหารราคามิตรภาพ' },
  'Liyue|Liuli Pavilion':           { note: 'ภัตตาคารหรู อาหารสไตล์ดั้งเดิม' },
  'Liyue|Wangshu Inn':              { owner: 'Owner: Verr Goldet',      note: 'โรงเตี๊ยมบนต้นไม้ยักษ์ ลิ้มรสอาหารต้นตำรับ' },
  'Liyue|Pops Kai\'s Tea':          { owner: 'Owner: Pops Kai',         note: 'ร้านชาโบราณริมทาง' },
  'Liyue|Emerald Maple Inn':        { owner: 'Owner: Mr. Shu',          note: 'โรงเตี๊ยม และที่พักบรรยากาศอบอุ่น' },
  'Liyue|Lianfang Dim Sum':         { owner: 'Owner: LianFang',         note: 'ร้านรถเข็นติ่มซำ' },
  'Inazuma|Shimura\'s':             { owner: 'Owner: Shimura Kanbei',   note: 'อาหารสไตล์กินดื่มหน้าเมือง' },
  'Inazuma|Kiminami Restaurant':    { owner: 'Owner: Kiminami Anna',    note: 'ร้านอาหารท้องถิ่น รสชาติดั้งเดิม' },
  'Inazuma|Ryouko\'s Street Food':  { owner: 'Owner: Ryouko',           note: 'อิ่มอร่อยริมทาง รสชาติอินาซึมะแท้ ๆ' },
  'Sumeru|Lambad\'s Tavern':        { owner: 'Owner: Lambad',           note: 'แหล่งพบปะสุดครึกครื้น เครื่องดื่มชื่นใจที่แลมบาดส์' },
  'Sumeru|Puspa Café':              { owner: 'Manager: Enteka',         note: 'จิบกาแฟเคล้ากลิ่นอายความรู้และชาคุณภาพ' },
  'Sumeru|Jut\'s Spice Shop':       { owner: 'Owner: Jut',              note: 'ที่สุดแห่งเครื่องเทศ คัดสรรพิเศษจากสุเมรุ' },
  'Sumeru|Jahangir\'s Delights':    { owner: 'Owner: Jahangir',         note: 'เมนูเด็ดถูกปาก รสชาติระดับสตรีทฟู้ดสุเมรุ' },
  'Sumeru|Ashpazi\'s Homemade':     { owner: 'Owner: Ashpazi',          note: 'อาหารโฮมเมดสูตรดั้งเดิม' },
  'Sumeru|Azalai\'s Merchat':       { owner: 'Owner: Azalai',           note: 'อาหารครบครันจากทะเลทราย ส่งตรงถึงมือคุณ' },
  'Fontaine|Snack Shop':            { owner: 'Owner: Louis',            note: 'ของว่างแสนอร่อย ทานบ่อย ๆ ก็ไม่เบื่อ' },
  'Fontaine|Café Lutece':           { owner: 'Owner: Arouet',           note: 'คาเฟ่สุดหรู บรรยากาศโรแมนติกอบอวล' },
  'Fontaine|Hotel Debord':          { owner: 'Owner: Vaneigem',         note: 'ดินเนอร์หรูระดับ 5 ดาว ประสบการณ์ชั้นเลิศในฟอนเทน' },
  'Natlan|Zakan\'s Street Bites':   { owner: 'Owner: Chanca',           note: 'สตรีทฟู้ดรสจัดจ้านสไตล์นัทลาน' },
  'NodKrai|Speranza':               { owner: 'Owner: Katya',            note: 'ลิ้มรสความหวังใหม่ บนเรือแห่งความทรงจำ' },
  'NodKrai|Limppu\'s Cart':         { owner: 'Owner: Limppu',           note: 'เบเกอร์รี่อบใหม่ ส่งตรงความอร่อยจากรถเข็น' },
  'NodKrai|The Flagship':           { owner: 'Owner: Demyan',           note: 'จุดนัดพบของนักเดินทาง อิ่มท้องพร้อมเล่าเรื่อง' },
  'Snezhnaya|Podvorye Restaurant':  { owner: 'Owner: Nefedov',          note: 'อุ่นกายสบายท้อง กับอาหารพื้นเมืองสเนซนาย่า' },
  'Snezhnaya|Kvasnik':              { owner: 'Owner: Zyryanov',         note: 'เครื่องดื่มมักสูตรลับ ดับความหนาวเย็น' }
};

// ---------------------------------------------------------------------
// เมนูอาหาร
// ---------------------------------------------------------------------
let currentMenu = []; // เก็บเมนูล่าสุดไว้ใช้เปิด popup รายละเอียดจาน (อ้างอิงด้วย id เท่านั้น กันปัญหา quote ในชื่อจาน)
let currentNation = null;
let nationsInMenu = []; // เมืองที่ปรากฏจริงในเมนูปัจจุบัน เรียงตาม NATION_ORDER
let currentView = 'sort';
let currentSort = 'insertion';
let currentCategory = 'all';
let menuSearchQuery = '';
const tray = new Map();
let traySubmitting = false;
let lastMobileTrayMode = null;
const USER_PROFILE_KEY = 'teyvat-order-profile';

function nationId(nation){
  return String(nation || 'other').toLowerCase().replace(/\s+/g, '');
}

function dishImageUrl(image){
  if(!image) return '';
  return /^https?:\/\//i.test(image) || image.startsWith('/')
    ? image
    : `/images/${encodeURIComponent(image)}`;
}

async function loadMenu(){
  const area = document.getElementById('menuArea');
  const params = new URLSearchParams(window.location.search);
  if(['sort','nation'].includes(params.get('view'))) currentView = params.get('view');
  if(['insertion','bubble'].includes(params.get('sort'))) currentSort = params.get('sort');
  if(['all','food','dessert','drink'].includes(params.get('category'))) currentCategory = params.get('category');
  area.innerHTML = `<div class="loading">กำลังโหลดเมนู...</div>`;
  try{
    const { data } = await api(`/menu?sort=${currentSort}`);
    if(!data.length){ area.innerHTML = `<div class="empty">ไม่พบเมนูอาหาร</div>`; return; }
    currentMenu = data;

    // เก็บลำดับเมืองที่ปรากฏจริงในเมนู (ตาม NATION_ORDER)
    const present = [...new Set(data.map(item => nationId(item.nation)))];
    nationsInMenu = NATION_ORDER.filter(id => present.includes(id));
    const requestedNation = params.get('nation');
    if(requestedNation && nationsInMenu.includes(requestedNation)){
      currentNation = requestedNation;
    } else if(!currentNation || !nationsInMenu.includes(currentNation)){
      currentNation = nationsInMenu[0];
    }

    renderMenuArea();
  }catch(err){
    area.innerHTML = `<div class="empty">โหลดเมนูไม่สำเร็จ: ${err.message}</div>`;
  }
}

function renderNationsNav(list){
  const nav = document.getElementById('nationsNav');
  if(currentView !== 'nation'){
    nav.innerHTML = '';
    return;
  }
  nav.innerHTML = list.map(id => {
    const meta = NATION_META[id] || NATION_META.other;
    return `<button class="nation-btn ${id===currentNation?'active':''}" onclick="selectNation('${id}')">
      <span class="dot" style="background:${meta.color}"></span>${meta.name}
    </button>`;
  }).join('');
}

function renderViewNav(){
  document.getElementById('viewNav').innerHTML = `
    <button class="view-btn ${currentView==='sort'?'active':''}" aria-pressed="${currentView==='sort'}" onclick="selectView('sort')">ทั้งหมด</button>
    <button class="view-btn ${currentView==='nation'?'active':''}" aria-pressed="${currentView==='nation'}" onclick="selectView('nation')">เมือง</button>`;
}

function updatePageUrl(){
  const url = new URL(window.location.href);
  url.searchParams.set('view', currentView);
  url.searchParams.set('sort', currentSort);
  url.searchParams.set('category', currentCategory);
  if(currentNation) url.searchParams.set('nation', currentNation);
  window.history.pushState({ view: currentView, sort: currentSort, nation: currentNation }, '', url);
}

function selectView(view){
  if(!['sort','nation'].includes(view)) return;
  currentView = view;
  updatePageUrl();
  renderMenuArea();
}

function selectPriceSort(sort){
  if(!['insertion','bubble'].includes(sort)) return;
  currentSort = sort;
  updatePageUrl();
  loadMenu();
}

function selectCategory(category){
  if(!['all','food','dessert','drink'].includes(category)) return;
  currentCategory = category;
  updatePageUrl();
  renderMenuArea();
}

function selectNation(id){
  if(!nationsInMenu.includes(id) || currentView !== 'nation') return;
  currentNation = id;
  updatePageUrl();
  renderMenuArea();
}

window.addEventListener('popstate', () => {
  const params = new URLSearchParams(window.location.search);
  currentView = ['sort','nation'].includes(params.get('view')) ? params.get('view') : 'sort';
  currentSort = ['insertion','bubble'].includes(params.get('sort')) ? params.get('sort') : 'insertion';
  currentCategory = ['all','food','dessert','drink'].includes(params.get('category')) ? params.get('category') : 'all';
  const requestedNation = params.get('nation');
  if(nationsInMenu.includes(requestedNation)) currentNation = requestedNation;
  renderMenuArea();
});

function renderMenuArea(){
  renderViewNav();
  renderNationsNav(nationsInMenu);
  if(currentView === 'sort') renderSortedMenu();
  else renderNationMenu();
}

function showWorkspace(workspace){
  const showOrders = workspace === 'orders';
  document.getElementById('menuWorkspace').hidden = showOrders;
  document.getElementById('orderWorkspace').hidden = !showOrders;
  document.getElementById('ordersFloatingBtn').classList.toggle('active', showOrders);
  document.getElementById('ordersFloatingBtn').setAttribute('aria-pressed', String(showOrders));
  if(showOrders) loadOrderManagement();
}

function renderSortedMenu(){
  const area = document.getElementById('menuArea');
  const categories = ['Food','Drink','Dessert'];
  const visibleCategories = currentCategory === 'all'
    ? categories
    : categories.filter(type => type.toLowerCase() === currentCategory);
  const query = menuSearchQuery.trim().toLowerCase();
  let html = `<div class="sort-page-head">
    <h2>เมนูทั้งหมด</h2>
    <div class="sort-controls">
      <label class="sortwrap" for="categorySelect">ประเภท:
        <select id="categorySelect" onchange="selectCategory(this.value)">
          <option value="all" ${currentCategory==='all'?'selected':''}>ทั้งหมด</option>
          <option value="food" ${currentCategory==='food'?'selected':''}>Food</option>
          <option value="dessert" ${currentCategory==='dessert'?'selected':''}>Dessert</option>
          <option value="drink" ${currentCategory==='drink'?'selected':''}>Drink</option>
        </select>
      </label>
      <label class="sortwrap" for="priceSortSelect">เรียงตามราคา:
        <select id="priceSortSelect" onchange="selectPriceSort(this.value)">
          <option value="insertion" ${currentSort==='insertion'?'selected':''}>น้อยไปมาก</option>
          <option value="bubble" ${currentSort==='bubble'?'selected':''}>มากไปน้อย</option>
        </select>
      </label>
    </div>
  </div>
  <div class="menu-search">
    <input type="search" id="menuSearchInput" value="${menuSearchQuery.replace(/"/g,'&quot;')}" placeholder="ค้นหาเมนูอาหาร..." oninput="onMenuSearchInput(this.value)">
  </div>`;
  let totalShown = 0;
  visibleCategories.forEach(type => {
    let items = currentMenu.filter(item => String(item.type).toLowerCase() === type.toLowerCase());
    if(query) items = items.filter(item => String(item.name).toLowerCase().includes(query));
    totalShown += items.length;
    html += `<section class="category-section">
      <div class="category-head"><h3>${type}</h3><span>${items.length} เมนู</span></div>
      <div class="dishes sorted-dishes">${items.map(item => dishCardHtml(item, true, true)).join('') || '<div class="empty">ไม่พบเมนูที่ตรงกับคำค้นหา</div>'}</div>
    </section>`;
  });
  area.innerHTML = html;
}

function onMenuSearchInput(value){
  menuSearchQuery = value;
  const focusPos = document.getElementById('menuSearchInput')?.selectionStart;
  renderSortedMenu();
  const input = document.getElementById('menuSearchInput');
  if(input){ input.focus(); input.setSelectionRange(focusPos, focusPos); }
}

function buildRestaurantsHtml(nationIdValue){
  const items = currentMenu.filter(item => nationId(item.nation) === nationIdValue);
  const restaurants = [];
  const byName = {};
  items.forEach(item => {
    const rName = item.restaurant || 'Teyvat Kitchen';
    if(!byName[rName]){ byName[rName] = { name: rName, dishes: [] }; restaurants.push(byName[rName]); }
    byName[rName].dishes.push(item);
  });
  const nationName = (NATION_META[nationIdValue] || NATION_META.other).name;
  return restaurants.map(r => {
    const meta = RESTAURANT_META[`${nationName}|${r.name}`] || { owner: '', note: '' };
    return `<div class="restaurant">
      <div class="restaurant-head">
        <h3>${r.name}</h3>${meta.owner ? `<span class="owner">${meta.owner}</span>` : ''}
        ${meta.note ? `<small>${meta.note}</small>` : ''}
        <span class="count">${r.dishes.length} เมนูในร้านนี้</span>
      </div>
      <div class="dishes">${r.dishes.map(item => dishCardHtml(item)).join('')}</div>
    </div>`;
  }).join('');
}

function renderNationMenu(){
  const area = document.getElementById('menuArea');
  const nationMeta = NATION_META[currentNation] || NATION_META.other;
  const items = currentMenu.filter(item => nationId(item.nation) === currentNation);

  let html = `<div class="nation-head">
    <div class="titlewrap"><h2>${nationMeta.name}</h2><span class="count" style="color:${nationMeta.color}">● ${items.length} เมนู</span></div>
  </div>`;

  html += buildRestaurantsHtml(currentNation);

  area.innerHTML = html;
}

function dishActionHtml(id){
  const quantity = tray.get(Number(id)) || 0;
  if(!quantity){
    return `<button class="add-btn" onclick="addToTray(${id})" ${traySubmitting?'disabled':''}>เพิ่ม</button>`;
  }
  return `<div class="qty-stepper" aria-label="จำนวนจาน">
    <button type="button" aria-label="ลดจำนวน" onclick="changeTrayQuantity(${id}, -1)" ${traySubmitting?'disabled':''}>−</button>
    <output>${quantity}</output>
    <button type="button" aria-label="เพิ่มจำนวน" onclick="changeTrayQuantity(${id}, 1)" ${traySubmitting?'disabled':''}>+</button>
  </div>`;
}

function addToTray(id){
  changeTrayQuantity(id, 1);
}

function changeTrayQuantity(id, delta){
  if(traySubmitting) return;
  id = Number(id);
  if(!currentMenu.some(item => item.id === id)) return;
  const previous = tray.get(id) || 0;
  const next = Math.max(0, Math.min(99, previous + delta));
  if(next) tray.set(id, next);
  else tray.delete(id);
  if(delta > 0 && previous === 0) setTrayCollapsed(false);
  renderTray();
  renderMenuArea();
  if(document.getElementById('dmodalOverlay').classList.contains('show')){
    const item = currentMenu.find(menuItem => menuItem.id === id);
    const modalAction = document.getElementById('modalDishAction');
    if(item && modalAction) modalAction.innerHTML = dishActionHtml(id);
  }
}

function renderTray(){
  const trayList = document.getElementById('trayList');
  if(!trayList) return;
  const lines = [...tray.entries()].map(([id, quantity]) => ({
    item: currentMenu.find(menuItem => menuItem.id === id),
    quantity,
  })).filter(line => line.item);
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const totalPrice = lines.reduce((sum, line) => sum + (Number(line.item.price) || 0) * line.quantity, 0);

  document.getElementById('trayCount').textContent = `${totalQuantity} จาน`;
  const totalText = `${totalPrice.toLocaleString()} Mora`;
  document.getElementById('trayTotal').textContent = totalText;
  document.getElementById('trayMobileTotal').textContent = totalText;
  trayList.innerHTML = lines.length ? lines.map(({ item, quantity }) => `
    <div class="tray-item">
      <div class="tray-item-name">${item.name}<small>${(Number(item.price)||0).toLocaleString()} Mora / จาน</small></div>
      ${dishActionHtml(item.id)}
    </div>`).join('') : `<div class="empty">ยังไม่มีอาหารในถาด</div>`;
  const uidReady = /^\d{4}$/.test(document.getElementById('uidLastFour').value);
  document.getElementById('checkoutBtn').disabled = !totalQuantity || traySubmitting || !uidReady;
  document.getElementById('checkoutHint').hidden = !totalQuantity || uidReady;
}

function setTrayCollapsed(collapsed){
  const trayCard = document.querySelector('.tray-card');
  const toggle = document.getElementById('trayMobileToggle');
  trayCard.classList.toggle('is-collapsed', collapsed);
  toggle.setAttribute('aria-expanded', String(!collapsed));
  toggle.setAttribute('aria-label', collapsed ? 'เปิดตะกร้า' : 'ย่อตะกร้า');
  toggle.title = collapsed ? 'เปิดตะกร้า' : 'ย่อตะกร้า';
}

function toggleMobileTray(){
  setTrayCollapsed(!document.querySelector('.tray-card').classList.contains('is-collapsed'));
}

function syncMobileTray(){
  if(lastMobileTrayMode === true) return;
  setTrayCollapsed(true);
  lastMobileTrayMode = true;
}

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function renderOrderQueue(items){
  const groups = [];
  items.forEach(item => {
    const previous = groups[groups.length - 1];
    if(item.receiptId && previous?.receiptId === item.receiptId) previous.items.push(item);
    else groups.push({ receiptId: item.receiptId || '', items: [item] });
  });

  const plateCount = items.length;
  document.getElementById('queueSummary').textContent = `${groups.length} ออเดอร์ · ${plateCount} จาน`;
  document.getElementById('queueBadge').textContent = groups.length;
  document.getElementById('serveNextBtn').disabled = !groups.length;
  if(!groups.length){
    document.getElementById('queueList').innerHTML = '<div class="empty">ยังไม่มีอาหารในคิว</div>';
    return;
  }

  document.getElementById('queueList').innerHTML = groups.map((group, index) => {
    const firstItem = group.items[0];
    const foodCounts = new Map();
    group.items.forEach(item => foodCounts.set(item.name, (foodCounts.get(item.name) || 0) + 1));
    const foods = [...foodCounts.entries()].map(([name, quantity]) =>
      `<li><span>${escapeHtml(name)}</span><small>×${quantity}</small></li>`
    ).join('');
    const cancelButton = group.receiptId
      ? `<button type="button" class="text-action danger-action" onclick="cancelQueuedOrder('${encodeURIComponent(group.receiptId)}')">ยกเลิกออเดอร์</button>`
      : '';
    return `<article class="queue-entry">
      <div class="queue-entry-heading">
        <div><strong>UID ${escapeHtml(firstItem.uid || 'ไม่ระบุ')}</strong><small>${escapeHtml(firstItem.orderTime || '')} · ${group.items.length} จาน</small></div>
        <span class="queue-status">${index === 0 ? 'ถัดไป' : 'รอคิว'}</span>
      </div>
      <ul>${foods}</ul>
      ${cancelButton}
    </article>`;
  }).join('');
}

function renderHistoryStack(entries){
  document.getElementById('historySummary').textContent = `${entries.length} รายการ`;
  document.getElementById('undoHistoryBtn').disabled = !entries.length;
  if(!entries.length){
    document.getElementById('historyList').innerHTML = '<div class="empty">ยังไม่มีประวัติ</div>';
    return;
  }

  const actionLabels = { ADD_ORDER: 'รับออเดอร์', SERVE_ORDER: 'เสิร์ฟแล้ว', CANCEL_ORDER: 'ยกเลิกออเดอร์' };
  document.getElementById('historyList').innerHTML = entries.map(entry => {
    const item = entry.item || {};
    const action = actionLabels[entry.action] || entry.action;
    const foodSummary = (entry.items || [item]).slice(0, 3).map(orderItem => escapeHtml(orderItem.name)).join(', ');
    const extraCount = (entry.items || [item]).length - 3;
    return `<article class="history-entry">
      <div class="history-entry-copy">
        <strong>${escapeHtml(action)} · UID ${escapeHtml(item.uid || 'ไม่ระบุ')}</strong>
        <small>${foodSummary}${extraCount > 0 ? ` +${extraCount}` : ''} · ${Number(entry.quantity) || 1} จาน</small>
        <small>${escapeHtml(item.orderTime || '')}</small>
      </div>
      <button type="button" class="text-action danger-action" onclick="deleteHistoryEntry('${encodeURIComponent(entry.historyId)}')">ลบ</button>
    </article>`;
  }).join('');
}

async function loadOrderManagement(){
  try{
    const [orders, historyData] = await Promise.all([api('/orders'), api('/history')]);
    renderOrderQueue(orders.items || []);
    renderHistoryStack(historyData.history || []);
  }catch(err){
    document.getElementById('queueList').innerHTML = `<div class="empty">โหลดคิวไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;
    document.getElementById('historyList').innerHTML = `<div class="empty">โหลดประวัติไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;
  }
}

async function serveNextOrder(){
  try{
    const result = await api('/orders/process', { method: 'DELETE' });
    showToast(result.message);
    await loadOrderManagement();
  }catch(err){
    showToast(err.message);
  }
}

async function cancelQueuedOrder(encodedReceiptId){
  try{
    const result = await api(`/orders/receipt/${encodedReceiptId}`, { method: 'DELETE' });
    showToast(result.message);
    await loadOrderManagement();
  }catch(err){
    showToast(err.message);
  }
}

async function deleteHistoryEntry(encodedHistoryId){
  try{
    const result = await api(`/history/${encodedHistoryId}`, { method: 'DELETE' });
    showToast(result.message);
    await loadOrderManagement();
  }catch(err){
    showToast(err.message);
  }
}

async function undoLastOrderAction(){
  try{
    const result = await api('/undo', { method: 'POST' });
    showToast(result.message);
    await loadOrderManagement();
  }catch(err){
    showToast(err.message);
  }
}

async function checkoutTray(){
  if(traySubmitting || !tray.size) return;
  const uid = document.getElementById('uidLastFour').value;
  if(!/^\d{4}$/.test(uid)){
    showToast('กรอก UID 4 ตัวท้ายก่อนยืนยันออเดอร์');
    document.getElementById('uidLastFour').focus();
    return;
  }
  traySubmitting = true;
  renderTray();
  const receiptId = globalThis.crypto?.randomUUID?.() || `receipt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const requested = [...tray.entries()];
  const receiptItems = requested.map(([id, quantity]) => {
    const item = currentMenu.find(menuItem => menuItem.id === id);
    const price = Number(item?.price) || 0;
    return { name: item?.name || 'เมนูอาหาร', quantity, subtotal: price * quantity };
  });
  const receiptTotal = receiptItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalAdded = requested.reduce((sum, [, quantity]) => sum + quantity, 0);
  let receipt = null;
  try{
    await api('/orders/batch', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ uid, receiptId, items: requested.map(([id, quantity]) => ({ id, quantity })) })
    });
    tray.clear();
    receipt = { uid, items: receiptItems, total: receiptTotal, quantity: totalAdded };
    showToast(`ยืนยันออเดอร์ UID ${uid} แล้ว`);
  }catch(err){
    showToast(err.message);
  }finally{
    traySubmitting = false;
    renderTray();
    renderMenuArea();
    if(receipt){
      setTrayCollapsed(true);
      openReceipt(receipt);
      void loadOrderManagement();
    }
  }
}

function openReceipt(receipt){
  document.getElementById('receiptUid').textContent = receipt.uid;
  document.getElementById('receiptCount').textContent = `${receipt.quantity} จาน`;
  document.getElementById('receiptItems').innerHTML = receipt.items.map(item => `
    <div class="receipt-item">
      <span>${item.name}<small>×${item.quantity}</small></span>
      <strong>${item.subtotal.toLocaleString()} Mora</strong>
    </div>`).join('');
  document.getElementById('receiptTotal').textContent = `${receipt.total.toLocaleString()} Mora`;
  document.getElementById('receiptOverlay').classList.add('show');
}

function closeReceipt(){
  document.getElementById('receiptOverlay').classList.remove('show');
}

function dishCardHtml(item, showOrder = true, showNation = false){
  const price = item.price ?? '-';
  const nationLabel = (NATION_META[nationId(item.nation)] || NATION_META.other).name;
  const img = `<div class="dish-img" onclick="openDish(${item.id})">
    ${item.image ? `<img src="${dishImageUrl(item.image)}" alt="${item.name}" onerror="this.hidden=true;this.nextElementSibling.hidden=false">` : ''}
    <span ${item.image ? 'hidden' : ''}>🍽️</span>
  </div>`;
  return `<div class="dish">
    ${img}
    <div class="dish-body">
      <h4 onclick="openDish(${item.id})">${item.name}</h4>
      ${showNation ? `<div class="dish-nation">${nationLabel}</div>` : ''}
      <div class="price">${price !== '-' ? price.toLocaleString() + ' Mora' : '-'}</div>
      ${showOrder ? dishActionHtml(item.id) : ''}
    </div>
  </div>`;
}

function saveUserProfile(){
  const nation = document.getElementById('userNationSelect').value;
  const uidLastFour = document.getElementById('uidLastFour').value;
  try{
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify({ nation, uidLastFour }));
  }catch(err){
    showToast('บันทึกข้อมูลในเบราว์เซอร์ไม่สำเร็จ');
  }
}

function updateSearchButtonState(){
  const selectedNation = document.getElementById('userNationSelect').value;
  const uidReady = /^\d{4}$/.test(document.getElementById('uidLastFour').value);
  const searchBtn = document.getElementById('searchGoBtn');
  if(searchBtn) searchBtn.disabled = !selectedNation || !uidReady;
}

function updateFieldPlaceholderStyle(){
  const nationSelect = document.getElementById('userNationSelect');
  if(nationSelect) nationSelect.classList.toggle('is-empty', !nationSelect.value);
}

function onSearchFieldChange(){
  saveUserProfile();
  updateSearchButtonState();
  updateFieldPlaceholderStyle();
}

function sanitizeUidInput(input){
  input.value = input.value.replace(/\D/g, '').slice(-4);
  saveUserProfile();
  updateSearchButtonState();
}

function initUserProfile(){
  const nationSelect = document.getElementById('userNationSelect');
  const uidInput = document.getElementById('uidLastFour');
  nationSelect.innerHTML += NATION_ORDER.filter(id => id !== 'other').map(id =>
    `<option value="${id}">${NATION_META[id].name}</option>`
  ).join('');
  try{
    const saved = JSON.parse(localStorage.getItem(USER_PROFILE_KEY) || '{}');
    if(NATION_ORDER.includes(saved.nation)) nationSelect.value = saved.nation;
    uidInput.value = String(saved.uidLastFour || '').replace(/\D/g, '').slice(-4);
  }catch(err){
    nationSelect.value = '';
  }
  updateSearchButtonState();
  updateFieldPlaceholderStyle();
}

function renderRecommended(nationIdValue){
  const section = document.getElementById('recommendedBlock');
  const list = document.getElementById('recommendedList');
  if(!nationsInMenu.includes(nationIdValue)){
    section.hidden = true;
    return;
  }
  list.innerHTML = buildRestaurantsHtml(nationIdValue);
  section.hidden = false;
}

function searchNearbyRestaurants(){
  const selectedNation = document.getElementById('userNationSelect').value;
  const uid = document.getElementById('uidLastFour').value;
  if(!selectedNation){
    showToast('เลือกเมืองก่อนค้นหาร้าน');
    return;
  }
  if(!/^\d{4}$/.test(uid)){
    showToast('กรอก UID 4 ตัวท้ายก่อนค้นหาร้าน');
    document.getElementById('uidLastFour').focus();
    return;
  }
  if(!nationsInMenu.includes(selectedNation)){
    showToast('ไม่พบร้านในเมืองที่เลือก');
    document.getElementById('recommendedBlock').hidden = true;
    return;
  }
  // แสดงร้าน + เมนูของเมืองนี้เป็นบล็อคแนะนำแทรกอยู่ในหน้า ไม่เปลี่ยนมุมมองหลัก/ไม่นำทางไปที่อื่น
  renderRecommended(selectedNation);
  showToast(`พบร้านแนะนำในเมือง ${(NATION_META[selectedNation] || NATION_META.other).name}`);
  document.getElementById('recommendedBlock')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------
// Popup รายละเอียดจาน (แสดงร้าน + วัตถุดิบที่ใช้)
// ---------------------------------------------------------------------
function openDish(id){
  const item = currentMenu.find(m => m.id === id);
  if(!item) return;
  const priceTxt = item.price != null ? `${item.price.toLocaleString()} Mora` : '-';
  const meta = RESTAURANT_META[`${(NATION_META[nationId(item.nation)] || NATION_META.other).name}|${item.restaurant}`];
  const nationName = (NATION_META[nationId(item.nation)] || NATION_META.other).name;
  const restLine = item.restaurant ? `${item.restaurant} · ${nationName}${meta?.owner ? ' · ' + meta.owner : ''}` : nationName;
  const ingredients = Array.isArray(item.ingredients) ? item.ingredients : [];
  const ingHtml = ingredients.length
    ? `<div class="lbl">วัตถุดิบที่ใช้</div><div class="ing-chips">${ingredients.map(i=>`<span>${i}</span>`).join('')}</div>`
    : '';

  document.getElementById('dmodalBox').innerHTML = `
    <div class="dmodal-img">
      ${item.image ? `<img src="${dishImageUrl(item.image)}" alt="${item.name}" onerror="this.hidden=true;this.nextElementSibling.hidden=false">` : ''}
      <span ${item.image ? 'hidden' : ''}>🍽️</span>
      <button class="dmodal-close" onclick="closeDish()">×</button>
    </div>
    <div class="dmodal-body">
      <h3>${item.name}</h3>
      <div class="rest">${restLine}</div>
      ${ingHtml}
      <div class="price">${priceTxt}</div>
      <div id="modalDishAction">${dishActionHtml(item.id)}</div>
    </div>`;
  document.getElementById('dmodalOverlay').classList.add('show');
}

function closeDish(){
  document.getElementById('dmodalOverlay').classList.remove('show');
}

// ---------------------------------------------------------------------
initUserProfile();
renderTray();
syncMobileTray();
loadOrderManagement();
loadMenu();