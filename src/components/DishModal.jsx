import Modal from './Modal.jsx';
import { Stepper } from './DishCard.jsx';
import { CATEGORIES, EFFECTS, NATIONS, formatMora } from '../data.js';

export default function DishModal({ dish, restaurant, qty, onAdd, onChange, onClose }) {
  const effect = EFFECTS.find((e) => e.id === dish.effect);
  const ingredients = Array.isArray(dish.ingredients) ? dish.ingredients.filter(Boolean) : [];
  const effectDescription = dish.effectDescription?.trim() || (effect ? `${effect.icon} ${effect.label}` : '');
  const icon = CATEGORIES.find((c) => c.id === dish.category)?.icon ?? '🍽️';
  return (
    <Modal onClose={onClose} className="dish-modal" label={dish.name}>
      <div className="dish-modal-img">
        {dish.image ? <img src={dish.image} alt={dish.name} /> : <span aria-hidden="true">{icon}</span>}
        {effect && <span className={`dish-effect-icon effect-${effect.id}`} role="img" aria-label={`${effect.label} effect`}>{effect.icon}</span>}
        {dish.rarity > 0 && <span className="dish-rarity" role="img" aria-label={`Rarity ${dish.rarity}`}>{'★'.repeat(dish.rarity)}</span>}
        <button type="button" className="icon-btn" onClick={onClose} aria-label="ปิด">×</button>
      </div>
      <div className="dish-modal-body">
        <h3>{dish.name}</h3>
        <p className="dish-modal-restaurant">
          {restaurant.name} at {NATIONS[restaurant.nation].name}
          {restaurant.owner && <><br />Owner : {restaurant.owner}</>}
        </p>
        {dish.genshin?.description && (
          <p className="dish-modal-genshin-description">{dish.genshin.description}</p>
        )}
        {ingredients.length > 0 && (
          <div className="ingredients">
            <strong> Ingredient </strong>
            <div className="chips">{ingredients.map((i) => <span key={i} className="chip">{i}</span>)}</div>
          </div>
        )}
        {effectDescription && (
          <p className="dish-modal-effect">
            <strong> Effect :</strong> {effectDescription}
          </p>
        )}
        <div className="dish-modal-row">
          <strong>{formatMora(dish.price)}</strong>
          {qty > 0 ? <Stepper qty={qty} onChange={(delta) => onChange(dish.id, delta)} /> : (
            <button type="button" className="btn small" onClick={() => onAdd(dish)}>Add</button>
          )}
        </div>
      </div>
    </Modal>
  );
}
