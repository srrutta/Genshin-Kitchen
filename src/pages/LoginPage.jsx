import { useState } from 'react';
import { NATION_ORDER, NATIONS, loginRequest } from '../data.js';

export default function LoginPage({ user, onLogin, onLogout, onBack }) {
  const [uid, setUid] = useState(user?.uid ?? '');
  const [nation, setNation] = useState(user?.nation ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');

  const missing = {
    uid: !/^\d{4}$/.test(uid),
    nation: !nation,
    address: !address,
  };
  const complete = !missing.uid && !missing.nation && !missing.address;
  const showError = touched && !complete; // Error 3

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!complete || busy) return;
    setBusy(true);
    setServerError('');
    try {
      const result = await loginRequest({ uid, nation, address });
      onLogin(result);
    } catch (err) {
      setServerError(err.message);
      setBusy(false);
    }
  };

  const err = (key) => (showError && missing[key] ? 'invalid' : '');

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit} noValidate>
        <h2>LOG IN</h2>
        <input
          className={err('uid')}
          inputMode="numeric"
          maxLength={4}
          value={uid}
          onChange={(e) => { setUid(e.target.value.replace(/\D/g, '').slice(0, 4)); setTouched(true); }}
          placeholder="UID 4 ตัวท้าย เช่น 8801"
          aria-label="UID 4 ตัวท้าย"
        />
        <select
          className={err('nation')}
          value={nation}
          onChange={(e) => { setNation(e.target.value); setAddress(''); setTouched(true); }}
          aria-label="Nation"
        >
          <option value="">Nation **</option>
          {NATION_ORDER.map((id) => <option key={id} value={id}>{NATIONS[id].name}</option>)}
        </select>
        <select
          className={err('address')}
          value={address}
          onChange={(e) => { setAddress(e.target.value); setTouched(true); }}
          disabled={!nation}
          aria-label="Landmark"
        >
          <option value="">{nation ? 'Landmark' : 'เลือก Nation ก่อน'}</option>
          {nation && NATIONS[nation].landmarks.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>

        {showError && <p className="error-text" role="alert">กรุณากรอกข้อมูลให้ครบ (UID 4 ตัวท้าย, Nation, Address)</p>}
        {serverError && <p className="error-text" role="alert">{serverError}</p>}

        <button className="btn dark wide" type="submit" disabled={!complete || busy}>
          {busy ? <><span className="spinner" /> กำลังตรวจสอบ…</> : 'ยืนยัน'}
        </button>
        <button className="btn ghost wide" type="button" onClick={onBack}>กลับ</button>
        {user && <button className="link-btn danger" type="button" onClick={onLogout}>ออกจากระบบ</button>}
      </form>
    </main>
  );
}
