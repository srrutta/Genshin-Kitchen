import { CATEGORIES, formatMora } from '../data.js';

const iconOf = (category) => CATEGORIES.find((c) => c.id === category)?.icon ?? '🍽️';

export function Stepper({ qty, onChange }) {
  return (
    <div className="stepper">
      <button type="button" aria-label="ลดจำนวน" onClick={() => onChange(-1)}>−</button>
      <output>{qty}</output>
      <button type="button" aria-label="เพิ่มจำนวน" onClick={() => onChange(1)}>+</button>
    </div>
  );
}

export default function DishCard({ dish, qty, onAdd, onChange, onOpen }) {
  return (
    <div className="dish-card">
      <button type="button" className="dish-img" onClick={() => onOpen(dish)} aria-label={`ดูรายละเอียด ${dish.name}`}>
        {dish.image
          ? <img src={dish.image} alt="" loading="lazy" />
          : <span aria-hidden="true">{iconOf(dish.category)}</span>}
      </button>
      <div className="dish-foot">
        <h4>{dish.name}</h4>
        <div className="dish-row">
          <span>{formatMora(dish.price)}</span>
          {qty > 0 ? (
            <Stepper qty={qty} onChange={(delta) => onChange(dish.id, delta)} />
          ) : (
            <button type="button" className="add-btn" onClick={() => onAdd(dish)} aria-label={`เพิ่ม ${dish.name}`}>+</button>
          )}
        </div>
      </div>
    </div>
  );
}
