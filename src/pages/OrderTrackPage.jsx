import { useEffect, useMemo, useState } from 'react';
import {
  ORDER_STATUS, STATUS_FLOW, fetchOrders, formatMora, isOrderActive, orderFinishAt,
} from '../data.js';
import { MinHeap } from '../graph.js';

const timeText = (ms) => new Date(ms).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

// ticker 1 วินาที — หยุดเมื่อไม่มีออเดอร์ที่ยังวิ่งอยู่ (cleanup ด้วย clearInterval)
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function OrderBlock({ order, onOpen }) {
  const status = order.status;
  const meta = ORDER_STATUS[status];
  return (
    <button type="button" className="order-block" onClick={() => onOpen(order.id)}>
      <div>
        <strong>{order.restaurantName}</strong>
        <small>{order.items.reduce((s, i) => s + i.qty, 0)} จาน · {formatMora(order.total)}</small>
      </div>
      <div className="order-right">
        <span className={`status-chip s-${status}`}>{meta.icon} {meta.label}</span>
        <small>{timeText(order.createdAt)}</small>
      </div>
    </button>
  );
}

function OrderDetail({ order, now, onBack, onCancel }) {
  const status = order.status;
  const meta = ORDER_STATUS[status];
  const idx = STATUS_FLOW.indexOf(status);
  const remain = Math.max(0, Math.ceil((orderFinishAt(order) - now) / 1000));
  return (
    <section className="order-detail">
      <button type="button" className="link-btn" onClick={onBack}>‹ ออเดอร์ทั้งหมด</button>
      <h2>{order.restaurantName}</h2>
      <p className="muted">สั่งเมื่อ {timeText(order.createdAt)} · ชำระด้วย {order.method}</p>

      <ol className="steps">
        {STATUS_FLOW.map((s, i) => (
          <li key={s} className={status === 'Cancelled' ? '' : i < idx ? 'done' : i === idx ? 'current' : ''}>
            <span className="step-icon">{ORDER_STATUS[s].icon}</span>
            <span>{s}</span>
          </li>
        ))}
        {status === 'Cancelled' && <li className="current cancelled"><span className="step-icon">❌</span><span>Cancelled</span></li>}
      </ol>

      <p className="status-line">{meta.icon} {meta.th}{status !== 'Completed' && status !== 'Cancelled' && ` · ถึงใน ~${remain} วิ`}</p>

      <ul className="order-items">
        {order.items.map((i) => (
          <li key={i.id}><span>{i.name} <small>× {i.qty}</small></span><strong>{formatMora(i.price * i.qty)}</strong></li>
        ))}
        <li><span>ค่าส่ง</span><strong>{formatMora(order.deliveryFee)}</strong></li>
        <li className="total"><span>รวม</span><strong>{formatMora(order.total)}</strong></li>
      </ul>

      <button type="button" className="btn ghost danger" disabled={!order.cancelable} onClick={() => onCancel(order.id)}>
        ยกเลิกออเดอร์
      </button>
      {!order.cancelable && status !== 'Cancelled' && <p className="hint">ยกเลิกได้เฉพาะสถานะ Pending / Accepted</p>}
    </section>
  );
}

export default function OrderTrackPage({ orders, initialOrderId, uid, onCancel, onOrdersChange, onHome }) {
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState(initialOrderId ?? null);

  useEffect(() => {
    let cancelled = false;
    fetchOrders(uid)
      .then((latest) => {
        if (!cancelled) {
          onOrdersChange(latest);
          setLoaded(true);
        }
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message || 'ไม่สามารถโหลดสถานะออเดอร์ได้'); });
    return () => { cancelled = true; };
  }, [uid, reloadKey, onOrdersChange]);

  const retry = () => {
    setError('');
    setLoaded(false);
    setReloadKey((key) => key + 1);
  };
  const hasActive = orders.some(isOrderActive);
  const now = useNow(hasActive);

  // Priority Queue (Min-Heap): ออเดอร์ที่จะถึงก่อนอยู่บนสุด
  const nextArrival = useMemo(() => {
    const heap = new MinHeap(orderFinishAt);
    orders.filter(isOrderActive).forEach((o) => heap.push(o));
    return { order: heap.peek(), count: heap.size };
  }, [orders]);

  const selected = orders.find((o) => o.id === selectedId);

  return (
    <main className="page">
      {error ? (
        <div className="state-box" role="alert">
          <p>{error}</p>
          <button className="btn small" onClick={retry}>ลองใหม่</button>
        </div>
      ) : !loaded ? (
        <div className="center-page" aria-busy="true"><div className="spinner big" /><p>กำลังโหลดรายการ…</p></div>
      ) : orders.length === 0 ? (
        <div className="state-box"><p>ยังไม่มีรายการสั่งซื้อ</p><button className="btn small" onClick={onHome}>ไป Homepage</button></div>
      ) : selected ? (
        <OrderDetail order={selected} now={now} onBack={() => setSelectedId(null)} onCancel={onCancel} />
      ) : (
        <>
          <h2 className="section-title">ORDERS</h2>
          {nextArrival.order && (
            <div className="next-arrival">
              <span className="spinner" /> ออเดอร์ที่จะถึงก่อน: <strong>{nextArrival.order.restaurantName}</strong>
              {' '}อีก ~{Math.max(0, Math.ceil((orderFinishAt(nextArrival.order) - now) / 1000))} วิ
              {nextArrival.count > 1 && ` (กำลังดำเนินการ ${nextArrival.count} ออเดอร์)`}
            </div>
          )}
          <div className="order-list">
            {orders.map((o) => <OrderBlock key={o.id} order={o} onOpen={setSelectedId} />)}
          </div>
        </>
      )}
    </main>
  );
}
