import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, EFFECTS, fetchAllMenu, NATIONS, NATION_ORDER } from '../data.js';
import { insertionSort } from '../graph.js';

export default function MenuPage({ onOpenRestaurant }) {
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('all');
  const [effect, setEffect] = useState('all');
  const [nation, setNation] = useState('all');

  useEffect(() => {
    const controller = new AbortController();
    fetchAllMenu({ signal: controller.signal })
      .then(setDishes)
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message || 'ไม่สามารถโหลดเมนูได้');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const retry = () => {
    setError('');
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const hasEffects = dishes.some((dish) => dish.effect);
  const visible = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    const filtered = dishes.filter((dish) =>
      (category === 'all' || dish.category === category)
      && (effect === 'all' || dish.effect === effect)
      && (nation === 'all' || dish.nation === nation)
      && (!query || `${dish.name} ${dish.restaurantName} ${dish.nation}`.toLowerCase().includes(query)));
    return insertionSort(filtered, (a, b) => a.name.localeCompare(b.name));
  }, [category, dishes, effect, keyword, nation]);

  return (
    <main className="page menu-page">
      <header className="menu-page-head">
        <div>
          <p className="eyebrow">TEYVAT KITCHEN</p>
          <h2 className="section-title">MENU</h2>
        </div>
        <label className="catalog-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="ค้นหาเมนูหรือร้านอาหาร"
            aria-label="ค้นหาเมนูหรือร้านอาหาร"
          />
        </label>
      </header>

      <div className="catalog-filters">
        <div className="effect-row" role="group" aria-label="ประเภทอาหาร">
          <button type="button" className={`effect-chip ${category === 'all' ? 'on' : ''}`} onClick={() => setCategory('all')}>All</button>
          {CATEGORIES.map((item) => (
            <button key={item.id} type="button" className={`effect-chip ${category === item.id ? 'on' : ''}`} onClick={() => setCategory(item.id)}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>
        <div className="effect-row" role="group" aria-label="Effect">
          {EFFECTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`effect-chip ${effect === item.id ? 'on' : ''}`}
              disabled={!hasEffects}
              onClick={() => setEffect(effect === item.id ? 'all' : item.id)}
            >
              {item.icon} {item.label}
            </button>
          ))}
          {!hasEffects && <span className="hint">ยังไม่มีข้อมูล Effect ใน menu.json</span>}
        </div>
        <label className="catalog-nation">
          <span>Nation</span>
          <select value={nation} onChange={(event) => setNation(event.target.value)}>
            <option value="all">ทุกเมือง</option>
            {NATION_ORDER.map((id) => <option key={id} value={id}>{NATIONS[id].name}</option>)}
          </select>
        </label>
      </div>

      {error ? (
        <div className="state-box" role="alert"><p>{error}</p><button type="button" className="btn small" onClick={retry}>ลองใหม่</button></div>
      ) : loading ? (
        <div className="dish-grid catalog-grid" aria-busy="true">
          {Array.from({ length: 10 }, (_, index) => <div key={index} className="dish-card skeleton" />)}
        </div>
      ) : visible.length ? (
        <div className="catalog-grid">
          {visible.map((dish) => (
            <button key={dish.id} type="button" className="catalog-card" onClick={() => onOpenRestaurant(dish.restaurantId, dish.id)}>
              <span className="catalog-image nation-art">
                {dish.image && <img src={dish.image} alt="" loading="lazy" />}
              </span>
              <span className="catalog-card-info">
                <strong>{dish.name}</strong>
                <small>{dish.restaurantName} · {NATIONS[dish.nation]?.name ?? dish.nation}</small>
                <span>{Number(dish.price).toLocaleString()} Mora</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="state-box"><p>ไม่พบเมนูตามเงื่อนไขที่เลือก</p></div>
      )}
    </main>
  );
}
