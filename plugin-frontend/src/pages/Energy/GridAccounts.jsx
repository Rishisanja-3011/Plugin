import { useEffect, useState } from 'react';
import api from '../../api/axios';
import './Energy.css';

export default function GridAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => setAccounts((await api.get('/admin/grid-operators')).data);
  useEffect(() => { load().catch(() => setMessage('Could not load grid accounts.')); }, []);
  const change = async (id) => {
    setBusy(true);
    try {
      if (id) await api.delete(`/admin/grid-operators/${id}`);
      else await api.post('/admin/grid-operators', { email });
      setEmail(''); await load(); setMessage('Access updated. The affected user must sign in again.');
    } catch (error) { setMessage(error.response?.data?.message || 'Could not update grid access.'); }
    finally { setBusy(false); }
  };
  return <main className="page-wrapper container energy__content">
    <h1>Grid operator access</h1>
    <p>Assign grid access to an existing verified account. Use a dedicated work account: this replaces its driver role and revokes its existing sessions.</p>
    <form className="energy__form" onSubmit={e => { e.preventDefault(); change(); }}>
      <label>Verified account email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <button className="btn btn--accent" disabled={busy}>Grant grid operator access</button>
    </form>
    {message && <p role="status">{message}</p>}
    {accounts.map(account => <article className="energy__panel" key={account.id}><h2>{account.fullName}</h2><p>{account.email}</p>
      <button disabled={busy} className="btn btn--outline" onClick={() => change(account.id)}>Revoke grid access</button></article>)}
  </main>;
}
