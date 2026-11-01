import { useState } from 'react';
import Modal from './Modal.jsx';
import { NATION_ORDER, NATIONS, TYPES } from '../data.js';

export const NO_SORT = { nearby: false, nations: [], types: [] };
export const isSorted = (o) => o.nearby || o.nations.length > 0 || o.types.length > 0;

const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// Nearby เลือกร่วมกับตัวเลือกอื่นไม่ได้ (Error 6) — ต้องกด clear all ก่อน
export default function HPSortPopup({ value, user, onApply, onClear, onClose }) {
  const [draft, setDraft] = useState(value);
  const [conflict, setConflict] = useState(false);

  const hasOthers = draft.nations.length > 0 || draft.types.length > 0;
  const guard = (fn) => () => { setConflict(false); fn(); };

  const clickNearby = () => {
    if (!user) return;
    if (hasOthers) return setConflict(true);
    setConflict(false);
    setDraft({ ...draft, nearby: !draft.nearby });
  };
  const clickOther = (key, v) => () => {
    if (draft.nearby) return setConflict(true);
    guard(() => setDraft({ ...draft, [key]: toggle(draft[key], v) }))();
  };

  return (
    <Modal onClose={onClose} className="sort-modal" label="ตัวกรอง">
      <div className="sort-head">
        <button type="button" className="icon-btn dark" onClick={onClose} aria-label="ปิด">×</button>
        <h3>ตัวกรอง</h3>
      </div>

      <div className="sort-section">
        <div className="sort-title">
          <h4>distance</h4>
          <button type="button" className="link-btn" onClick={() => { setDraft(NO_SORT); setConflict(false); onClear(); }}>clear all</button>
        </div>
        <button
          type="button"
          className={`pill ${draft.nearby ? 'on' : ''} ${hasOthers || !user ? 'disabled' : ''}`}
          aria-pressed={draft.nearby}
          onClick={clickNearby}
        >near</button>
        {!user && <p className="hint">Login ก่อนเพื่อใช้ Nearby</p>}
      </div>

      <div className="sort-section">
        <h4>type</h4>
        <div className="pills">
          {Object.entries(TYPES).map(([id, t]) => (
            <button key={id} type="button" aria-pressed={draft.types.includes(id)}
              className={`pill ${draft.types.includes(id) ? 'on' : ''} ${draft.nearby ? 'disabled' : ''}`}
              onClick={clickOther('types', id)}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="sort-section">
        <h4>NATION</h4>
        <div className="pills">
          {NATION_ORDER.map((id) => (
            <button key={id} type="button" aria-pressed={draft.nations.includes(id)}
              className={`pill ${draft.nations.includes(id) ? 'on' : ''} ${draft.nearby ? 'disabled' : ''}`}
              onClick={clickOther('nations', id)}>{NATIONS[id].name}</button>
          ))}
        </div>
      </div>

      {conflict && (
        <p className="error-text" role="alert">ไม่สามารถเลือก Nearby พร้อมตัวเลือกอื่นได้ — กด clear all ก่อน</p>
      )}
      <button type="button" className="btn dark wide" onClick={() => onApply(draft)}>search</button>
    </Modal>
  );
}
