import { useEffect, useMemo, useState } from 'react';
import DishCard from '../components/DishCard.jsx';
import DishModal from '../components/DishModal.jsx';
import Modal from '../components/Modal.jsx';
import { CATEGORIES, EFFECTS, NATIONS, TYPES, fetchMenu, deliveryInfo, STAGE_SECONDS } from '../data.js';
import { insertionSort } from '../graph.js';

export default function RestauMenuPage({
  restaurantId, initialDishId, user, cart, favorites,
  onToggleFav, onAddToCart, onReplaceCart, onChangeQty, onLogin, onHome, showToast,
}) {
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState('');
  const [errorRestaurantId, setErrorRestaurantId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [effect, setEffect] = useState('all');
  const [openDish, setOpenDish] = useState(null);
  const [needLogin, setNeedLogin] = useState(false); // Error 1
  const [conflictDish, setConflictDish] = useState(null); // Error 2

  // state เฉพาะหน้านี้ — ดึงเมนูใหม่เมื่อเปลี่ยนร้าน
  useEffect(() => {
    const ctrl = new AbortController();
    fetchMenu(restaurantId, { signal: ctrl.signal })
      .then((data) => {
        setError('');
        setErrorRestaurantId(null);
        setMenu(data);
        if (initialDishId) setOpenDish(data.dishes.find((dish) => dish.id === Number(initialDishId)) ?? null);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message || 'ไม่สามารถดึงข้อมูลได้');
          setErrorRestaurantId(restaurantId);
        }
      });
    return () => ctrl.abort();
  }, [restaurantId, initialDishId, reloadKey]);

  const activeMenu = menu?.restaurant.id === restaurantId ? menu : null;
  const restaurant = activeMenu?.restaurant;
  const activeError = errorRestaurantId === restaurantId ? error : '';
  const qtyOf = (id) => cart.items.find((i) => i.id === id)?.qty ?? 0;

  const handleAdd = (dish) => {
    if (!user) return setNeedLogin(true);
    if (cart.restaurantId && cart.restaurantId !== dish.restaurantId && cart.items.length) {
      return setConflictDish(dish);
    }
    onAddToCart(dish, restaurant);
    showToast('เพิ่มลงตะกร้าแล้ว');
  };

  const sections = useMemo(() => {
    if (!activeMenu) return [];
    const filterSort = (list) => {
      const filtered = effect === 'all' ? list : list.filter((d) => d.effect === effect);
      return effect === 'all' ? filtered : insertionSort(filtered, (a, b) => a.price - b.price);
    };
    const today = filterSort(activeMenu.menuOfDay);
    const rest = CATEGORIES.map((c) => ({
      key: c.id,
      title: c.label.toUpperCase(),
      dishes: filterSort(activeMenu.dishes.filter((d) => d.category === c.id)),
    }));
    const sections = effect === 'all' ? [{ key: 'today', title: 'TODAY MENU', dishes: today }] : [];
    return [...sections, ...rest].filter((s) => s.dishes.length > 0);
  }, [activeMenu, effect]);

  if (!restaurant) {
    if (!activeError) {
      return <main className="page center-page" aria-busy="true"><div className="spinner big" /><p>กำลังโหลดเมนู…</p></main>;
    }
    return (
      <main className="page"><div className="state-box" role="alert"><p>{activeError}</p><div className="state-actions"><button className="btn small" onClick={() => setReloadKey((key) => key + 1)}>ลองใหม่</button><button className="btn small ghost" onClick={onHome}>กลับ Homepage</button></div></div></main>
    );
  }

  const isFav = favorites.includes(restaurant.id);
  const nation = NATIONS[restaurant.nation] ?? { name: restaurant.nation };
  const eta = user ? deliveryInfo(restaurant.nation, user.nation) : null;
  const prep = STAGE_SECONDS.Pending + STAGE_SECONDS.Accepted + STAGE_SECONDS.Preparing;
  const hasEffects = activeMenu.dishes.some((dish) => dish.effect);

  const dishCard = (dish) => (
    <DishCard key={dish.id} dish={dish} qty={qtyOf(dish.id)} onAdd={handleAdd} onChange={onChangeQty} onOpen={setOpenDish} />
  );

  return (
    <>
      <section className={`menu-hero nation-${restaurant.nation}`}>
        {restaurant.coverImage && <img className="menu-hero-image" src={restaurant.coverImage} alt="" />}
        <h2>{restaurant.name}</h2>
        <button
          type="button"
          className={`fav-btn hero ${isFav ? 'on' : ''}`}
          aria-pressed={isFav}
          aria-label={isFav ? 'ยกเลิก Favorite' : 'เพิ่ม Favorite'}
          onClick={() => onToggleFav(restaurant.id)}
        >{isFav ? '★' : '☆'}</button>
      </section>
      <section className="menu-info">
        <span className="pill-info">{nation.name}</span>
        {restaurant.owner && <span>Owner by {restaurant.owner}</span>}
        <span>{TYPES[restaurant.type]?.label ?? TYPES.restaurant.label}</span>
        <span className="grow">{restaurant.note}</span>
        <span>⏱ เตรียม ~{prep} วิ{eta ? ` + ส่ง ~${eta.eta} วิ (ค่าส่ง ${eta.fee} Mora)` : ' + ส่ง ~15–40 วิ'}</span>
      </section>

      <main className="page">
        <div className="effect-row" role="tablist" aria-label="กรองตามผลของอาหาร">
          <button type="button" className={`effect-chip ${effect === 'all' ? 'on' : ''}`} onClick={() => setEffect('all')}>🍴 All</button>
          {EFFECTS.map((e) => (
            <button key={e.id} type="button" disabled={!hasEffects} className={`effect-chip ${effect === e.id ? 'on' : ''}`} onClick={() => setEffect(e.id)}>
              {e.icon} {e.label}
            </button>
          ))}
        </div>
        {!hasEffects && <p className="hint effect-note">ยังไม่มีข้อมูล Effect ใน menu.json</p>}

        {error ? (
          <div className="state-box" role="alert">
            <p>ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่อีกครั้ง</p>
            <div className="state-actions">
              <button className="btn small" onClick={() => setReloadKey((k) => k + 1)}>ลองใหม่</button>
              <button className="btn small ghost" onClick={onHome}>กลับ Homepage</button>
            </div>
          </div>
        ) : !menu ? (
          <div className="dish-grid" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="dish-card skeleton" />)}
          </div>
        ) : sections.length === 0 ? (
          <div className="state-box"><p>ไม่พบเมนูตามเงื่อนไขที่เลือก</p><button className="btn small" onClick={() => setEffect('all')}>แสดงทั้งหมด</button></div>
        ) : (
          sections.map((s) => (
            <section key={s.key} className={`menu-section ${s.key === 'today' ? 'today' : ''}`}>
              <h3 className="menu-section-title">{s.title}</h3>
              <div className="dish-grid">{s.dishes.map(dishCard)}</div>
            </section>
          ))
        )}
      </main>

      {openDish && (
        <DishModal
          dish={openDish}
          restaurant={restaurant}
          qty={qtyOf(openDish.id)}
          onAdd={handleAdd}
          onChange={onChangeQty}
          onClose={() => setOpenDish(null)}
        />
      )}

      {needLogin && (
        <Modal onClose={() => setNeedLogin(false)} className="alert-modal" label="ต้อง Login">
          <h3>ต้อง Login ก่อน</h3>
          <p>กรุณา Login ก่อนจึงจะเพิ่มสินค้าลงตะกร้าได้</p>
          <div className="modal-actions">
            <button className="btn dark" onClick={() => { setNeedLogin(false); onLogin(); }}>ไปหน้า Login</button>
            <button className="btn ghost" onClick={() => setNeedLogin(false)}>ปิด</button>
          </div>
        </Modal>
      )}

      {conflictDish && (
        <Modal onClose={() => setConflictDish(null)} className="alert-modal" label="ตะกร้ามีของร้านอื่น">
          <h3>สั่งได้ทีละ 1 ร้าน</h3>
          <p>คุณมีสินค้าจากร้าน {cart.restaurantName} อยู่แล้ว ต้องการล้างตะกร้าเพื่อสั่งจากร้าน {restaurant.name} หรือไม่</p>
          <div className="modal-actions">
            <button className="btn dark" onClick={() => { onReplaceCart(conflictDish, restaurant); setConflictDish(null); showToast('เพิ่มลงตะกร้าแล้ว'); }}>ล้างและสั่งจากร้าน {restaurant.name}</button>
            <button className="btn ghost" onClick={() => setConflictDish(null)}>เก็บตะกร้าเดิม</button>
          </div>
        </Modal>
      )}
    </>
  );
}
