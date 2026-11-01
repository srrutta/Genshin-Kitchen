import { NATIONS, TYPES, deliveryInfo } from '../data.js';

export default function RestaurantCard({ restaurant, isFav, userNation, onToggleFav, onOpen }) {
  const eta = userNation
    ? `${deliveryInfo(restaurant.nation, userNation).eta} วิ`
    : '15–40 วิ';
  return (
    <article
      className="rest-card"
      tabIndex={0}
      role="button"
      onClick={() => onOpen(restaurant.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(restaurant.id);
        }
      }}
    >
      <div className={`rest-img nation-${restaurant.nation}`} aria-hidden="true">
        {restaurant.coverImage
          ? <img className="restaurant-photo" src={restaurant.coverImage} alt="" loading="lazy" />
          : <span className="rest-initial">{restaurant.name[0]}</span>}
      </div>
      <button
        type="button"
        className={`fav-btn ${isFav ? 'on' : ''}`}
        aria-pressed={isFav}
        aria-label={isFav ? 'ยกเลิก Favorite' : 'เพิ่ม Favorite'}
        onClick={(e) => { e.stopPropagation(); onToggleFav(restaurant.id); }}
      >
        {isFav ? '★' : '☆'}
      </button>
      <div className="rest-info">
        <small>in {NATIONS[restaurant.nation].name}</small>
        <h3>{restaurant.name}</h3>
        <div className="rest-meta">
          <span>{TYPES[restaurant.type].label}</span>
          <span>⏱ ETA {eta}</span>
        </div>
      </div>
    </article>
  );
}
