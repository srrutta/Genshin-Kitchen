import { useEffect, useMemo, useState } from 'react';
import RestaurantCard from '../components/RestaurantCard.jsx';
import HPSortPopup, { NO_SORT, isSorted } from '../components/HPSortPopup.jsx';
import { CATEGORIES, EFFECTS, NATION_ORDER, fetchRestaurants } from '../data.js';
import { buildSearchIndex, canNavigate, insertionSort, searchIndex } from '../graph.js';

const byName = (a, b) => a.name.localeCompare(b.name);
const byNationThenName = (a, b) =>
  NATION_ORDER.indexOf(a.nation) - NATION_ORDER.indexOf(b.nation) || byName(a, b);

function Skeletons({ count = 10 }) {
  return (
    <div className="rest-grid" aria-busy="true" aria-label="กำลังโหลด">
      {Array.from({ length: count }, (_, i) => <div key={i} className="rest-card skeleton" />)}
    </div>
  );
}

export default function HomePage({ user, favorites, onToggleFav, onOpenRestaurant, onOpenCatalog }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [sortOption, setSortOption] = useState(NO_SORT);
  const [popupOpen, setPopupOpen] = useState(false);

  // ดึงร้านทั้งหมด (ใช้ AbortController เป็น cleanup)
  useEffect(() => {
    const ctrl = new AbortController();
    fetchRestaurants({ signal: ctrl.signal })
      .then((data) => { setRestaurants(data); setLoading(false); })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'ไม่สามารถดึงข้อมูลได้');
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [reloadKey]);

  // debounce 300ms — ช่องว่างจะกลับไปแสดงร้านทั้งหมด
  useEffect(() => {
    const t = setTimeout(() => setQuery(keyword), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  // Hash Table ของ keyword → id ร้าน (ชื่อร้าน, เมือง, ประเภท, ชื่อเมนู)
  const index = useMemo(
    () => buildSearchIndex(restaurants.map((r) => ({
      id: r.id,
      text: [r.name, r.nation, r.type, ...r.dishNames].join(' '),
    }))),
    [restaurants],
  );

  const visible = useMemo(() => {
    let list = restaurants;
    const ids = searchIndex(index, query);
    if (ids) list = list.filter((r) => ids.has(r.id));

    const { nearby, nations, types } = sortOption;
    if (nearby) {
      list = insertionSort(list.filter((r) => user && r.nation === user.nation), byName);
    } else if (nations.length || types.length) {
      list = list.filter((r) =>
        (!nations.length || nations.includes(r.nation)) && (!types.length || types.includes(r.type)));
      list = insertionSort(list, byNationThenName);
    }
    return list;
  }, [restaurants, index, query, sortOption, user]);

  // Favorite คงตำแหน่งเดิมเสมอ ไม่ว่าจะ Sort/ค้นหาอยู่หรือไม่
  const favRestaurants = useMemo(
    () => favorites.map((id) => restaurants.find((r) => r.id === id)).filter(Boolean),
    [favorites, restaurants],
  );

  const sorted = isSorted(sortOption);
  const clearSort = () => setSortOption(NO_SORT);
  const reload = () => {
    setError('');
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const card = (r) => (
    <RestaurantCard
      key={r.id}
      restaurant={r}
      isFav={favorites.includes(r.id)}
      userNation={user?.nation}
      onToggleFav={onToggleFav}
      onOpen={onOpenRestaurant}
    />
  );

  return (
    <>
      <section className="search-strip">
        <form className="searchbar" onSubmit={(e) => { e.preventDefault(); setQuery(keyword); }} role="search">
          <span className="search-icon" aria-hidden="true" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search for dishes, restuarants..."
            aria-label="ค้นหาร้านหรือเมนู"
          />
          <button type="submit" className="find-btn">FIND</button>
        </form>
        {canNavigate('home', 'hpsort') && (
          <button type="button" className={`filter-btn ${sorted ? 'on' : ''}`} onClick={() => setPopupOpen(true)} aria-label="ตัวกรอง">
            ⛛{sorted && <span className="dot" />}
          </button>
        )}
      </section>
      <nav className="home-categories" aria-label="ค้นหาอาหารตามประเภทหรือ Effect">
        <button type="button" className="home-category" onClick={() => onOpenCatalog({ category: 'all', effect: 'all' })}>
          <span aria-hidden="true">🍴</span>All
        </button>
        {CATEGORIES.map((item) => (
          <button key={item.id} type="button" className="home-category" onClick={() => onOpenCatalog({ category: item.id, effect: 'all' })}>
            <span aria-hidden="true">{item.icon}</span>{item.label}
          </button>
        ))}
        {EFFECTS.map((item) => (
          <button key={item.id} type="button" className="home-category" onClick={() => onOpenCatalog({ category: 'all', effect: item.id })}>
            <span aria-hidden="true">{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>

      <main className="page">
        {error ? (
          <div className="state-box" role="alert">
            <p>ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่อีกครั้ง</p>
            <div className="state-actions">
              <button type="button" className="btn small" onClick={reload}>ลองใหม่</button>
              <button type="button" className="btn small ghost" onClick={() => { setKeyword(''); reload(); }}>กลับ Homepage</button>
            </div>
          </div>
        ) : (
          <>
            {favRestaurants.length > 0 && (
              <section className="block fav-block">
                <h2 className="section-title">FAVORITE</h2>
                <div className="fav-row">{favRestaurants.map(card)}</div>
              </section>
            )}

            <section className="block">
              <h2 className="section-title">ALL</h2>
              {loading ? <Skeletons /> : visible.length > 0 ? (
                <div className="rest-grid">{visible.map(card)}</div>
              ) : query.trim() ? (
                <div className="state-box"><p>No Results Found</p></div>
              ) : (
                <div className="state-box">
                  <p>ไม่พบร้านตามเงื่อนไขที่เลือก</p>
                  <button type="button" className="btn small" onClick={clearSort}>Clear Sort</button>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {popupOpen && (
        <HPSortPopup
          value={sortOption}
          user={user}
          onApply={(opt) => { setSortOption(opt); setPopupOpen(false); }}
          onClear={clearSort}
          onClose={() => setPopupOpen(false)}
        />
      )}
    </>
  );
}
