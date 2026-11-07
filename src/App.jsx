import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import Navbar from './components/Navbar.jsx';
import CartPill from './components/CartPill.jsx';
import YourCart from './components/YourCart.jsx';
import Toast from './components/Toast.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MenuPage from './pages/MenuPage.jsx';
import RestauMenuPage from './pages/RestauMenuPage.jsx';
import CheckOutPage from './pages/CheckOutPage.jsx';
import OrderTrackPage from './pages/OrderTrackPage.jsx';
import { Stack, canNavigate } from './graph.js';
import { cancelOrder as cancelOrderRequest, createOrder, fetchOrders, findUnavailable, isOrderActive } from './data.js';

const HOME = { name: 'home', params: {} };
const EMPTY_CART = { restaurantId: null, restaurantName: '', restaurantNation: null, items: [] };
const APP_HISTORY_KEY = 'teyvat-kitchen';

// โหลดข้อมูลฝั่ง UI จาก localStorage; สถานะออเดอร์อ่านจาก Express
const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
};
const loadSessionUser = () => {
  try {
    const raw = sessionStorage.getItem('tk-user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const saveSessionUser = (user) => {
  try { sessionStorage.setItem('tk-user', JSON.stringify(user)); } catch { /* ignore */ }
};

export default function App() {
  const [user, setUser] = useState(loadSessionUser);
  const [cart, setCart] = useState(() => load('tk-cart-v2', EMPTY_CART));
  const [favorites, setFavorites] = useState(() => load('tk-favs-v2', []));
  const [orders, setOrders] = useState([]);

  const [page, setPage] = useState(HOME);
  const previousPages = useRef(new Stack()); // Stack: Previous Page
  const historyInitialized = useRef(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(0);

  useEffect(() => saveSessionUser(user), [user]);
  useEffect(() => {
    try { localStorage.removeItem('tk-user'); } catch { /* ignore */ }
  }, []);
  useEffect(() => save('tk-cart-v2', cart), [cart]);
  useEffect(() => save('tk-favs-v2', favorites), [favorites]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    const appUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (!historyInitialized.current) {
      window.history.replaceState({ app: APP_HISTORY_KEY, sentinel: true }, '', appUrl);
      window.history.pushState({ app: APP_HISTORY_KEY, page: HOME, previous: [] }, '', appUrl);
      historyInitialized.current = true;
    }

    const handlePopState = (event) => {
      if (event.state?.app !== APP_HISTORY_KEY) return;
      if (event.state.sentinel) {
        previousPages.current.clear();
        setPage(HOME);
        setCartOpen(false);
        window.history.pushState({ app: APP_HISTORY_KEY, page: HOME, previous: [] }, '', appUrl);
      } else if (event.state.page?.name) {
        previousPages.current.clear();
        (event.state.previous ?? []).forEach((previousPage) => previousPages.current.push(previousPage));
        setPage(event.state.page);
        setCartOpen(false);
      }
      window.scrollTo(0, 0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    fetchOrders(user.uid)
      .then((latest) => { if (active) setOrders(latest); })
      .catch((error) => {
        if (active) showToast(error.message || 'ไม่สามารถโหลดออเดอร์ได้');
      });
    return () => { active = false; };
  }, [user, showToast]);

  const hasActiveOrders = orders.some(isOrderActive);
  useEffect(() => {
    if (!user || !hasActiveOrders) return undefined;
    let active = true;
    const timer = setInterval(() => {
      fetchOrders(user.uid)
        .then((latest) => { if (active) setOrders(latest); })
        .catch((error) => console.error('Unable to refresh order statuses:', error));
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user, hasActiveOrders]);

  // ---------- Navigation (ตาม Graph FLOW + Stack) ----------
  const navigate = useCallback((to, params = {}, from = page.name) => {
    if (!canNavigate(from, to)) return false;
    previousPages.current.push(page);
    const nextPage = { name: to, params };
    window.history.pushState({
      app: APP_HISTORY_KEY,
      page: nextPage,
      previous: previousPages.current.toArray(),
    }, '', window.location.href);
    setPage(nextPage);
    setCartOpen(false);
    window.scrollTo(0, 0);
    return true;
  }, [page]);

  const goHome = useCallback(() => {
    previousPages.current.clear();
    window.history.pushState({ app: APP_HISTORY_KEY, page: HOME, previous: [] }, '', window.location.href);
    setPage(HOME);
    setCartOpen(false);
    window.scrollTo(0, 0);
  }, []);

  const goBack = useCallback(() => {
    window.history.back();
  }, []);

  // ---------- Auth ----------
  const handleLogin = (profile) => {
    setUser(profile);
    showToast(`เข้าสู่ระบบสำเร็จ · UID ${profile.uid}`); // Success: Login
    goBack(); // กลับหน้าล่าสุดที่มา (Error 1 → Login → กลับมาที่เดิม)
  };

  const handleLogout = () => {
    setUser(null);
    setOrders([]);
    setCart(EMPTY_CART);
    showToast('ออกจากระบบแล้ว');
    goHome();
  };

  // ---------- Favorites (ไม่ซ้ำ, กดซ้ำเพื่อยกเลิก) ----------
  const toggleFav = (id) =>
    setFavorites((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  // ---------- Cart (1 ร้านต่อ 1 order) ----------
  const toLine = (dish) => ({ id: dish.id, name: dish.name, price: dish.price, qty: 1 });

  const addToCart = (dish, restaurant) =>
    setCart((c) => {
      const exist = c.items.find((i) => i.id === dish.id);
      const items = exist
        ? c.items.map((i) => (i.id === dish.id ? { ...i, qty: Math.min(99, i.qty + 1) } : i))
        : [...c.items, toLine(dish)];
      return {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        restaurantNation: restaurant.nation,
        items,
      };
    });

  const replaceCart = (dish, restaurant) =>
    setCart({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantNation: restaurant.nation,
      items: [toLine(dish)],
    });

  const changeQty = (id, delta) =>
    setCart((c) => {
      const items = c.items
        .map((i) => (i.id === id ? { ...i, qty: Math.min(99, i.qty + delta) } : i))
        .filter((i) => i.qty > 0);
      return items.length ? { ...c, items } : EMPTY_CART;
    });

  const removeItem = (id) =>
    setCart((c) => {
      const items = c.items.filter((i) => i.id !== id);
      return items.length ? { ...c, items } : EMPTY_CART;
    });

  const clearCart = () => setCart(EMPTY_CART);

  const cartCount = cart.items.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.items.reduce((s, i) => s + i.price * i.qty, 0);

  const openCart = () => canNavigate(page.name, 'cart') && setCartOpen(true);

  // YourCart → CheckOut: ตรวจว่าสินค้ายังมีอยู่ก่อน
  const goCheckout = async () => {
    if (!cart.items.length) {
      showToast('ตะกร้าของคุณว่างเปล่า'); // Error 5
      return goHome();
    }
    let missing;
    try {
      missing = await findUnavailable(cart.restaurantId, cart.items.map((i) => i.id));
    } catch (error) {
      showToast(error.message || 'ไม่สามารถตรวจสอบรายการอาหารได้');
      return undefined;
    }
    if (missing.length) {
      setCart((c) => {
        const items = c.items.filter((i) => !missing.includes(i.id));
        return items.length ? { ...c, items } : EMPTY_CART;
      });
      showToast('มีสินค้าบางรายการไม่สามารถสั่งได้แล้ว จึงนำออกจากตะกร้า');
      return undefined;
    }
    return navigate('checkout', {}, 'cart');
  };

  // ---------- Orders ----------
  const placeOrder = async ({ method }) => {
    const { order } = await createOrder({
      uid: user.uid,
      nation: user.nation,
      restaurantId: cart.restaurantId,
      items: cart.items.map(({ id, qty }) => ({ id, qty })),
      method,
    });
    setOrders((list) => [order, ...list]);
    setCart(EMPTY_CART);
    navigate('orders', { orderId: order.id });
  };

  const handleCancelOrder = async (id) => {
    try {
      const { order } = await cancelOrderRequest(id, user.uid);
      setOrders((list) => list.map((item) => (item.id === id ? order : item)));
      showToast('ยกเลิกออเดอร์แล้ว');
    } catch (error) {
      if (error.status === 409) {
        showToast(error.message);
        try {
          setOrders(await fetchOrders(user.uid));
        } catch (refreshError) {
          showToast(refreshError.message || 'ไม่สามารถโหลดสถานะออเดอร์ได้');
        }
        return;
      }
      showToast(error.message || 'ไม่สามารถยกเลิกออเดอร์ได้');
    }
  };

  const activeOrders = orders.filter(isOrderActive).length;

  // ---------- Render ----------
  let content;
  switch (page.name) {
    case 'login':
      content = <LoginPage user={user} onLogin={handleLogin} onLogout={handleLogout} onBack={goBack} />;
      break;
    case 'catalog':
      content = (
        <MenuPage
          initialCategory={page.params.category}
          initialEffect={page.params.effect}
          onOpenRestaurant={(restaurantId, dishId) => navigate('menu', { restaurantId, dishId }, 'catalog')}
        />
      );
      break;
    case 'menu':
      content = (
        <RestauMenuPage
          restaurantId={page.params.restaurantId}
          initialDishId={page.params.dishId}
          user={user}
          cart={cart}
          favorites={favorites}
          onToggleFav={toggleFav}
          onAddToCart={addToCart}
          onReplaceCart={replaceCart}
          onChangeQty={changeQty}
          onLogin={() => navigate('login')}
          onHome={goHome}
          showToast={showToast}
        />
      );
      break;
    case 'checkout':
      content = (
        <CheckOutPage
          cart={cart}
          user={user}
          onPlaceOrder={placeOrder}
          onEmptyCart={() => { showToast('ตะกร้าของคุณว่างเปล่า'); goHome(); }}
          showToast={showToast}
        />
      );
      break;
    case 'orders':
      content = (
        <OrderTrackPage
          orders={orders}
          initialOrderId={page.params.orderId}
          uid={user?.uid}
          onCancel={handleCancelOrder}
          onOrdersChange={setOrders}
          onHome={goHome}
        />
      );
      break;
    default:
      content = (
        <HomePage
          user={user}
          favorites={favorites}
          onToggleFav={toggleFav}
          onOpenRestaurant={(restaurantId) => navigate('menu', { restaurantId })}
          onOpenCatalog={(filters) => navigate('catalog', filters)}
        />
      );
  }

  return (
    <div className="app">
      <Navbar
        page={page.name}
        user={user}
        activeOrders={activeOrders}
        onNavigate={(to) => navigate(to)}
        onHome={goHome}
        onBack={goBack}
      />
      {content}

      {canNavigate(page.name, 'cart') && (
        <CartPill total={cartTotal} count={cartCount} onOpen={openCart} />
      )}

      {cartOpen && (
        <YourCart
          cart={cart}
          total={cartTotal}
          onChangeQty={changeQty}
          onRemove={removeItem}
          onClear={clearCart}
          onCheckout={goCheckout}
          onBrowse={() => { setCartOpen(false); goHome(); }}
          onClose={() => setCartOpen(false)}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}
