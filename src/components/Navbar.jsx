import { useEffect, useState } from 'react';
import { canNavigate } from '../graph.js';
import { NATIONS } from '../data.js';

const clock = () =>
  new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });

// แสดงเฉพาะลิงก์ที่ Graph (FLOW) อนุญาตจากหน้าปัจจุบัน
export default function Navbar({ page, user, activeOrders, onNavigate, onHome, onBack }) {
  const [time, setTime] = useState(clock);

  useEffect(() => {
    const t = setInterval(() => setTime(clock()), 30000);
    return () => clearInterval(t);
  }, []);

  const showHome = page === 'home' || canNavigate(page, 'home');
  const showOrders = page !== 'orders' && Boolean(user) && canNavigate(page, 'orders');
  const showLogin = canNavigate(page, 'login');
  const showBack = canNavigate(page, 'previous');

  return (
    <header className="navbar">
      <div className="navbar-row">
        <div>
          <div className="greeting">
            {showBack && (
              <button className="icon-btn" type="button" onClick={onBack} aria-label="กลับหน้าก่อนหน้า">‹</button>
            )}
            <span>{time} Hello, Are u Hungry? ?</span>
          </div>
          <h1 className="brand">TEYVAT KITCHEN</h1>
        </div>
        <nav className="nav-links" aria-label="เมนูหลัก">
          {showHome && (
            <button type="button" className={`nav-link ${page === 'home' ? 'active' : ''}`} onClick={onHome}>HOME</button>
          )}
          {showOrders && (
            <button type="button" className={`nav-link ${page === 'orders' ? 'active' : ''}`} onClick={() => onNavigate('orders')}>
              ORDERS{activeOrders > 0 && <span className="badge">{activeOrders}</span>}
            </button>
          )}
          {showLogin && (
            <button type="button" className="you-in" onClick={() => onNavigate('login')}>
              📍 {user ? `#${user.uid} · ${NATIONS[user.nation].name}` : 'You In'} ▾
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
