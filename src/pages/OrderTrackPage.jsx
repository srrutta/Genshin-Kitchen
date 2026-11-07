import { useEffect, useMemo, useState } from 'react';
import {
  ORDER_STATUS, STATUS_FLOW, STAGE_SECONDS, fetchOrders, formatMora, isOrderActive, orderFinishAt,
} from '../data.js';
import { MinHeap } from '../graph.js';
import pendingArtwork from '../assets/order-status/pending.svg?raw';
import confirmedArtwork from '../assets/order-status/confirmed.svg?raw';
import preparingArtwork from '../assets/order-status/preparing.svg?raw';
import deliveryArtwork from '../assets/order-status/out-for-delivery.svg?raw';
import deliveredArtwork from '../assets/order-status/delivered.svg?raw';

const timeText = (ms) => new Date(ms).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const clockText = (ms) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const trackingSteps = [
  { status: 'Pending', label: 'PENDING', offset: 0 },
  { status: 'Accepted', label: 'ORDER CONFIRMED', offset: STAGE_SECONDS.Pending },
  { status: 'Preparing', label: 'PREPARING YOUR ORDER', offset: STAGE_SECONDS.Pending + STAGE_SECONDS.Accepted },
  { status: 'Leading', label: 'OUT FOR DELIVERY', offset: STAGE_SECONDS.Pending + STAGE_SECONDS.Accepted + STAGE_SECONDS.Preparing },
  { status: 'Completed', label: 'DELIVERED', offset: null },
];

function OrderArtwork({ status }) {
  const artwork = {
    Pending: pendingArtwork,
    Accepted: confirmedArtwork,
    Preparing: preparingArtwork,
    Leading: deliveryArtwork,
    Completed: deliveredArtwork,
  }[status];
  if (artwork) return <div className="tracking-artwork-host" dangerouslySetInnerHTML={{ __html: artwork }} />;
  return (
    <div className="tracking-artwork-host">
      <svg className="tracking-artwork" viewBox="0 0 300 180" role="img" aria-label="ออเดอร์ถูกยกเลิก">
        <g fill="#574213">
          <path d="M36 143h228l-15 19c-5 7-12 10-21 10H73c-9 0-16-3-21-10z" />
          <path d="M58 141a92 92 0 0 1 184 0z" />
          <rect x="137" y="38" width="26" height="14" rx="6" />
          <ellipse cx="150" cy="36" rx="20" ry="8" />
          <circle cx="208" cy="65" r="48" />
        </g>
        <path d="m191 48 34 34m0-34-34 34" fill="none" stroke="#FFFAE3" strokeWidth="9" strokeLinecap="round" />
      </svg>
    </div>
  );
}

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

function OrderDetail({ order, now, onBack, onCancel, onHome }) {
  const status = order.status;
  const idx = STATUS_FLOW.indexOf(status);
  const remain = Math.max(0, Math.ceil((orderFinishAt(order) - now) / 1000));
  const statusText = {
    Pending: "Hang tight! We're waiting for confirmation",
    Accepted: "Your order is confirmed, Let's get cooking",
    Preparing: 'Your delicious meal is being prepared',
    Leading: "It's on the way! Get ready to enjoy",
    Completed: 'Delivered with care. Enjoy your meal',
    Cancelled: 'This order was cancelled',
  }[status];
  const isDelivering = status === 'Leading';
  const arrivalLabel = isDelivering
    ? 'ARRIVING IN'
    : status === 'Completed' || status === 'Cancelled'
      ? 'ORDER STATUS'
      : "YOU'LL GET YOUR ORDER IN ABOUT";
  const arrivalText = status === 'Completed'
    ? 'DELIVERED'
    : status === 'Cancelled'
      ? 'CANCELLED'
      : isDelivering
        ? `${String(Math.floor(remain / 60)).padStart(2, '0')}:${String(remain % 60).padStart(2, '0')}`
        : `${Math.max(1, Math.ceil(remain / 60))} ${Math.ceil(remain / 60) === 1 ? 'MINUTE' : 'MINUTES'}`;
  const offsets = trackingSteps.map((step, index) => index === trackingSteps.length - 1
    ? STAGE_SECONDS.Pending + STAGE_SECONDS.Accepted + STAGE_SECONDS.Preparing + order.eta
    : step.offset);
  return (
    <div className="order-tracking-page">
      <section className={`order-tracking status-${status.toLowerCase()}`}>
        <header className="tracking-heading">
          <h2>ORDER TRACKING</h2>
        </header>

        <div className="tracking-arrival" aria-live="polite">
          <span>{arrivalLabel}</span>
          <strong key={status} className="tracking-arrival-value">{arrivalText}</strong>
          {isDelivering && <small>MIN : SEC</small>}
        </div>

        <div key={status} className={`tracking-illustration tracking-illustration-${status.toLowerCase()}`}>
          <OrderArtwork status={status} />
          <p className="tracking-status-copy">{statusText}</p>
        </div>
        <div className="tracking-order-id">
          <strong>#{`ORDER${order.id.slice(0, 8).toUpperCase()}`}</strong>
          <span>UID {order.uid}</span>
        </div>

        <div className="tracking-process-panel">
          <ol className="tracking-timeline">
            {trackingSteps.map((step, index) => {
              const stepTime = order.createdAt + offsets[index] * 1000;
              const complete = status !== 'Cancelled' && index < idx;
              const current = status !== 'Cancelled' && index === idx;
              return (
                <li key={step.status} className={`${complete ? 'done' : ''} ${current ? 'current' : ''}`}>
                  <span className="tracking-step-marker">{complete || (index === 0 && status !== 'Cancelled') ? '✓' : ''}</span>
                  <strong>{step.label}</strong>
                  <time>{complete || current ? clockText(stepTime) : 'Upcoming'}</time>
                </li>
              );
            })}
            {status === 'Cancelled' && (
              <li className="current cancelled">
                <span className="tracking-step-marker">×</span>
                <strong>ORDER CANCELLED</strong>
                <time>{clockText(order.cancelledAt ?? now)}</time>
              </li>
            )}
          </ol>

          <details className="tracking-summary">
            <summary>ORDER DETAILS · {order.restaurantName} · {formatMora(order.total)}</summary>
            <ul className="order-items">
              {order.items.map((item) => (
                <li key={item.id}><span>{item.name} <small>× {item.qty}</small></span><strong>{formatMora(item.price * item.qty)}</strong></li>
              ))}
              <li><span>ค่าส่ง</span><strong>{formatMora(order.deliveryFee)}</strong></li>
              <li className="total"><span>รวม</span><strong>{formatMora(order.total)}</strong></li>
              <li><span>สั่งเมื่อ {timeText(order.createdAt)} · {order.method}</span></li>
            </ul>
          </details>
        </div>

        <div className="tracking-actions">
          {order.cancelable && <button type="button" className="tracking-cancel" onClick={() => onCancel(order.id)}>CANCEL ORDER</button>}
          <button type="button" className="tracking-order-button" onClick={onBack}>YOUR ORDER</button>
          <button type="button" className="tracking-again" onClick={onHome}>ORDER AGAIN</button>
        </div>
      </section>
    </div>
  );
}

export default function OrderTrackPage({ orders, initialOrderId, uid, onCancel, onOrdersChange, onHome }) {
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState(initialOrderId ?? null);

  useEffect(() => {
    if (selectedId) window.scrollTo(0, 0);
  }, [selectedId]);

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
    <main className={selected ? 'order-track-shell' : 'page'}>
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
        <OrderDetail order={selected} now={now} onBack={() => setSelectedId(null)} onCancel={onCancel} onHome={onHome} />
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
