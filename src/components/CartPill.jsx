import { formatMora } from '../data.js';

export default function CartPill({ total, count, onOpen }) {
  return (
    <button type="button" className="cart-pill" onClick={onOpen} aria-label={`ตะกร้า ${count} จาน`}>
      <span className="cart-total">{formatMora(total)}</span>
      <span className="cart-bag">
        🛍️{count > 0 && <span className="badge">{count}</span>}
      </span>
    </button>
  );
}
