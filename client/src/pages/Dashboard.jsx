import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { fmtDateTime, money } from '../utils';

const CARDS = {
  EMPLOYEE: [
    ['Total vouchers', 'total'], ['Draft vouchers', 'drafts'], ['Pending approval', 'pending'],
    ['Approved vouchers', 'approved'], ['Rejected vouchers', 'rejected'], ['Total amount claimed', 'total_claimed', true],
  ],
  DIRECTOR: [
    ['Pending approval', 'pending_count'], ['Approved today', 'approved_today'],
    ['Rejected today', 'rejected_today'], ['Total pending amount', 'pending_amount', true],
  ],
  ACCOUNTS: [
    ['Total vouchers', 'total'], ['Pending approval', 'pending'], ['Approved vouchers', 'approved'],
    ['Rejected vouchers', 'rejected'], ['Total approved amount', 'approved_amount', true],
  ],
};
const RECENT_TITLE = { EMPLOYEE: 'Recently updated', DIRECTOR: 'Recent voucher activity', ACCOUNTS: 'Recent approved vouchers' };

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="center-note">Loading…</p>;

  return (
    <>
      <div className="page-head">
        <h2>Welcome, {user.name.split(' ')[0]}</h2>
        {user.role === 'EMPLOYEE' && <Link className="btn btn-primary" to="/vouchers/new">Create voucher</Link>}
        {user.role === 'DIRECTOR' && <Link className="btn btn-primary" to="/pending">Review pending</Link>}
      </div>

      <div className="stats">
        {CARDS[user.role].map(([label, key, isMoney]) => (
          <div className="stat card" key={key}>
            <span className="stat-label">{label}</span>
            <strong>{isMoney ? money(data.stats[key]) : data.stats[key]}</strong>
          </div>
        ))}
      </div>

      <section className="card">
        <h3>{RECENT_TITLE[user.role]}</h3>
        {data.recent.length === 0 ? (
          <p className="muted">Nothing here yet.</p>
        ) : (
          <ul className="activity">
            {data.recent.map((r, i) => (
              <li key={i}>
                <div>
                  <Link to={`/vouchers/${r.voucherId}`}>{r.voucherNumber}</Link> — {r.title}
                  <div className="muted small">{r.label}{r.by ? ` · ${r.by}` : ''} · {fmtDateTime(r.at)}</div>
                </div>
                <strong>{money(r.amount)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
