import Modal from './Modal.jsx';
import { Stepper } from './DishCard.jsx';
import { CATEGORIES, EFFECTS, NATIONS, formatMora } from '../data.js';

export default function DishModal({ dish, restaurant, qty, onAdd, onChange, onClose }) {
  const effect = EFFECTS.find((e) => e.id === dish.effect);
  const icon = CATEGORIES.find((c) => c.id === dish.category)?.icon ?? '🍽️';
  return (
    <Modal onClose={onClose} className="dish-modal" label={dish.name}>
      <div className="dish-modal-img">
        {dish.image ? <img src={dish.image} alt={dish.name} /> : <span aria-hidden="true">{icon}</span>}
        <button type="button" className="icon-btn light" onClick={onClose} aria-label="ปิด">×</button>
      </div>
      <div className="dish-modal-body">
        <h3>{dish.name}</h3>
        <p className="muted light">{restaurant.name} at {NATIONS[restaurant.nation].name}{restaurant.owner && <><br />Owner : {restaurant.owner}</>}</p>
        <div className="ingredients">
          <strong>วัตถุดิบที่ใช้</strong>
          <div className="chips">{dish.ingredients.map((i) => <span key={i} className="chip">{i}</span>)}</div>
        </div>
        <p className="muted light">
          Effect: {dish.effectDescription || (effect ? `${effect.icon} ${effect.label}` : 'ยังไม่มีข้อมูลใน menu.json')}
        </p>
        <div className="dish-modal-row">
          <strong>{formatMora(dish.price)}</strong>
          {qty > 0 ? <Stepper qty={qty} onChange={(delta) => onChange(dish.id, delta)} /> : (
            <button type="button" className="btn small" onClick={() => onAdd(dish)}>เพิ่มลงตะกร้า</button>
          )}
        </div>
      </div>
    </Modal>
  );
}
