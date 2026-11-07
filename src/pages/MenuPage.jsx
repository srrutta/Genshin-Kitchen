import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, EFFECTS, fetchAllMenu, NATIONS, NATION_ORDER } from '../data.js';
import { insertionSort } from '../graph.js';

export default function MenuPage({ onOpenRestaurant, initialCategory = 'all', initialEffect = 'all' }) {
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [category] = useState(initialCategory);
  const [effect] = useState(initialEffect);
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

  const categoryLabel = category === 'all'
    ? effect === 'all'
      ? 'ALL'
      : EFFECTS.find((item) => item.id === effect)?.label.toUpperCase() ?? 'ALL'
    : CATEGORIES.find((item) => item.id === category)?.label.toUpperCase() ?? 'ALL';
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
          <h2 className="section-title">MENU</h2>
        </div>
        <label className="catalog-search">
          <span className="search-icon" aria-hidden="true" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="ค้นหาเมนูหรือร้านอาหาร"
            aria-label="ค้นหาเมนูหรือร้านอาหาร"
          />
        </label>
      </header>

      <div className="catalog-category-bar">
        <h2>{categoryLabel}</h2>
        <label className="catalog-nation">
          <span>NATION :</span>
          <select value={nation} onChange={(event) => setNation(event.target.value)}>
            <option value="all">all</option>
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
