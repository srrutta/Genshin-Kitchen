import { useState } from 'react';
import Modal from './Modal.jsx';
import { Stepper } from './DishCard.jsx';
import { formatMora } from '../data.js';

export default function YourCart({ cart, total, onChangeQty, onRemove, onClear, onCheckout, onBrowse, onClose }) {
  const [checking, setChecking] = useState(false);
  const empty = cart.items.length === 0;

  const handleOrder = async () => {
    setChecking(true);
    try { await onCheckout(); } finally { setChecking(false); }
  };

  return (
    <Modal onClose={onClose} className="cart-modal" label="ตะกร้า">
      <div className="cart-head">
        <h3>MY TRAY</h3>
        {!empty && <p>ORDER TO <strong>{cart.restaurantName}</strong></p>}
        <button type="button" className="icon-btn light" onClick={onClose} aria-label="ปิด">×</button>
      </div>
      <div className="cart-body">
        {empty ? (
          <div className="empty-state">
            <p>ยังไม่มีสินค้าในตะกร้า</p>
            <button type="button" className="btn small" onClick={onBrowse}>ไปเลือกร้านอาหาร</button>
          </div>
        ) : (
          <ul className="cart-list">
            {cart.items.map((it) => (
              <li key={it.id}>
                <div>
                  <strong>{it.name}</strong>
                  <small>{it.price.toLocaleString()} / จาน</small>
                </div>
                <div className="cart-actions">
                  <Stepper qty={it.qty} onChange={(delta) => onChangeQty(it.id, delta)} />
                  <button type="button" className="link-btn danger" onClick={() => onRemove(it.id)} aria-label={`ลบ ${it.name}`}>ลบ</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!empty && (
        <div className="cart-foot">
          <div className="cart-sum"><span>รวม</span><strong>{formatMora(total)}</strong></div>
          <div className="cart-buttons">
            <button type="button" className="btn ghost" onClick={onClear} disabled={checking}>Clear Cart</button>
            <button type="button" className="btn ghost" onClick={onClose} disabled={checking}>back</button>
            <button type="button" className="btn dark" onClick={handleOrder} disabled={checking}>
              {checking ? <><span className="spinner" /> ตรวจสอบ…</> : 'order'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
