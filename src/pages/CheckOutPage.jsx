import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { NATIONS, deliveryInfo, formatMora } from '../data.js';

const METHODS = [
  { id: 'bank', label: 'โอนผ่านธนาคาร', icon: '🏦' },
  { id: 'promptpay', label: 'พร้อมเพย์ (QR)', icon: '📱' },
  { id: 'cod', label: 'ชำระปลายทาง', icon: '💵' },
];

export default function CheckOutPage({ cart, user, onPlaceOrder, onEmptyCart, showToast }) {
  const [ready, setReady] = useState(false);
  const [method, setMethod] = useState('bank');
  const [payOpen, setPayOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const empty = cart.items.length === 0;

  // Error 5: เข้า CheckOut โดยตะกร้าว่าง → redirect Homepage
  useEffect(() => {
    if (empty) { onEmptyCart(); return undefined; }
    const t = setTimeout(() => setReady(true), 800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const restaurantNation = cart.restaurantNation;
  const restaurant = restaurantNation
    ? { name: cart.restaurantName, nation: restaurantNation }
    : null;
  const info = useMemo(
    () => (restaurantNation && user ? deliveryInfo(restaurantNation, user.nation) : null),
    [restaurantNation, user],
  );
  const subtotal = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
  const total = subtotal + (info?.fee ?? 0);

  if (empty || !restaurant || !user || !info) return null;

  if (!ready) {
    return (
      <main className="page center-page" aria-busy="true">
        <div className="spinner big" />
        <p>กำลังตรวจสอบสินค้าและคำนวณราคา…</p>
      </main>
    );
  }

  const complete = async () => {
    setSubmitting(true);
    try {
      await onPlaceOrder({ method });
      setPayOpen(false);
      showToast('สั่งอาหารสำเร็จ');
    } catch (error) {
      showToast(error.message || 'ไม่สามารถยืนยันออเดอร์ได้');
    } finally {
      setSubmitting(false);
    }
  };

  const confirm = () => (method === 'cod' ? complete() : setPayOpen(true));

  return (
    <main className="page checkout">
      <section className="receipt">
        <h2>ใบเสร็จ · {restaurant.name}</h2>
        <ul>
          {cart.items.map((i) => (
            <li key={i.id}>
              <span>{i.name} <small>× {i.qty}</small></span>
              <strong>{formatMora(i.price * i.qty)}</strong>
            </li>
          ))}
        </ul>
        <div className="receipt-line"><span>ค่าอาหาร</span><span>{formatMora(subtotal)}</span></div>
        <div className="receipt-line"><span>ค่าส่ง ({restaurant.nation === user.nation ? 'Same Nation' : 'Other Nation'})</span><span>{formatMora(info.fee)}</span></div>
        <div className="receipt-line total"><span>รวมทั้งสิ้น</span><strong>{formatMora(total)}</strong></div>
        <div className="receipt-line"><span>เวลาจัดส่งโดยประมาณ</span><span>~{info.eta} วิ</span></div>
      </section>

      <section className="receipt">
        <h3>ที่อยู่จัดส่ง</h3>
        <p>UID ลงท้าย {user.uid}<br />{user.address}, {NATIONS[user.nation].name}</p>
      </section>

      <section className="receipt">
        <h3>ช่องทางชำระเงิน</h3>
        <div className="methods">
          {METHODS.map((m) => (
            <label key={m.id} className={`method ${method === m.id ? 'on' : ''}`}>
              <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} />
              <span>{m.icon} {m.label}</span>
            </label>
          ))}
        </div>
        <button type="button" className="btn dark wide" onClick={confirm} disabled={submitting}>
          {submitting ? 'กำลังยืนยัน…' : `ยืนยันการสั่งซื้อ · ${formatMora(total)}`}
        </button>
      </section>

      {payOpen && (
        <Modal onClose={() => setPayOpen(false)} className="alert-modal" label="หน้าชำระเงิน">
          <h3>{method === 'bank' ? '🏦 หน้าธนาคาร (จำลอง)' : '📱 สแกน QR พร้อมเพย์ (จำลอง)'}</h3>
          {method === 'promptpay' && <div className="qr" aria-hidden="true">▦▦▦<br />▦ ▦<br />▦▦▦</div>}
          <p>นี่คือหน้าจ่ายเงินจำลอง ไม่มีข้อมูลจริง · ยอดชำระ {formatMora(total)}</p>
          <div className="modal-actions">
            <button className="btn dark" onClick={complete} disabled={submitting}>{submitting ? 'กำลังยืนยัน…' : 'เสร็จสิ้น'}</button>
            <button className="btn ghost" onClick={() => setPayOpen(false)} disabled={submitting}>ยกเลิก</button>
          </div>
        </Modal>
      )}
    </main>
  );
}
