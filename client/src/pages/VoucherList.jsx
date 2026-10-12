import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';
import { fmtDate, money } from '../utils';

const EMPTY = { search: '', department: '', category: '', status: '', dateFrom: '', dateTo: '', minAmount: '', maxAmount: '', sortBy: 'createdAt', order: 'desc' };
const SORT_OPTIONS = [
  ['createdAt', 'Created date'], ['updatedAt', 'Last updated'], ['expenseDate', 'Expense date'],
  ['amount', 'Amount'], ['voucherNumber', 'Voucher number'], ['employeeName', 'Employee name'], ['status', 'Status'],
];

export default function VoucherList({ title, fixedStatus }) {
  const { user } = useAuth();
  const isEmployee = user.role === 'EMPLOYEE';
  const [meta, setMeta] = useState({ categories: [], departments: [], statuses: [] });
  const [form, setForm] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/meta').then(setMeta).catch(() => {}); }, []);

  useEffect(() => {
    const qs = new URLSearchParams({ page, limit: 10 });
    Object.entries(applied).forEach(([k, v]) => v !== '' && qs.set(k, v));
    if (fixedStatus) qs.set('status', fixedStatus);
    setLoading(true);
    api.get(`/vouchers?${qs}`)
      .then((r) => { setResult(r); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [applied, page, fixedStatus]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const apply = (e) => {
    e.preventDefault();
    if (form.minAmount && form.maxAmount && Number(form.minAmount) > Number(form.maxAmount)) return setError('Minimum amount cannot exceed maximum amount.');
    if (form.dateFrom && form.dateTo && form.dateFrom > form.dateTo) return setError('"From" date cannot be after "To" date.');
    setPage(1);
    setApplied(form);
  };
  const reset = () => { setForm(EMPTY); setApplied(EMPTY); setPage(1); };
  const statuses = meta.statuses.filter((s) => isEmployee || s !== 'Draft');

  return (
    <>
      <div className="page-head">
        <h2>{title}</h2>
        {isEmployee && <Link className="btn btn-primary" to="/vouchers/new">Create voucher</Link>}
      </div>

      <form className="card filters" onSubmit={apply}>
        <div className="field wide">
          <label>Search</label>
          <input placeholder="Voucher number, employee or title" value={form.search} onChange={set('search')} />
        </div>
        <div className="field"><label>Department</label>
          <select value={form.department} onChange={set('department')}>
            <option value="">All</option>{meta.departments.map((d) => <option key={d}>{d}</option>)}
          </select></div>
        <div className="field"><label>Category</label>
          <select value={form.category} onChange={set('category')}>
            <option value="">All</option>{meta.categories.map((d) => <option key={d}>{d}</option>)}
          </select></div>
        {!fixedStatus && (
          <div className="field"><label>Status</label>
            <select value={form.status} onChange={set('status')}>
              <option value="">All</option>{statuses.map((d) => <option key={d}>{d}</option>)}
            </select></div>
        )}
        <div className="field"><label>Expense date from</label><input type="date" value={form.dateFrom} onChange={set('dateFrom')} /></div>
        <div className="field"><label>Expense date to</label><input type="date" value={form.dateTo} onChange={set('dateTo')} /></div>
        <div className="field"><label>Min amount</label><input type="number" min="0" value={form.minAmount} onChange={set('minAmount')} /></div>
        <div className="field"><label>Max amount</label><input type="number" min="0" value={form.maxAmount} onChange={set('maxAmount')} /></div>
        <div className="field"><label>Sort by</label>
          <select value={form.sortBy} onChange={set('sortBy')}>
            {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
        <div className="field"><label>Order</label>
          <select value={form.order} onChange={set('order')}><option value="desc">Newest / highest first</option><option value="asc">Oldest / lowest first</option></select></div>
        <div className="filter-actions">
          <button className="btn btn-primary">Apply</button>
          <button type="button" className="btn btn-ghost" onClick={reset}>Reset</button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Voucher no.</th>{!isEmployee && <th>Employee</th>}<th>Title</th><th>Department</th>
              <th>Expense date</th><th className="num">Amount</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="7" className="muted">Loading…</td></tr>}
            {!loading && result?.data.length === 0 && (
              <tr><td colSpan="7" className="muted">No vouchers match these filters.</td></tr>
            )}
            {!loading && result?.data.map((v) => (
              <tr key={v.id}>
                <td><Link to={`/vouchers/${v.id}`}>{v.voucherNumber}</Link></td>
                {!isEmployee && <td>{v.employeeName}</td>}
                <td>{v.title}</td><td>{v.department}</td><td>{fmtDate(v.expenseDate)}</td>
                <td className="num">{money(v.amount)}</td><td><StatusBadge status={v.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result && (
        <div className="pager">
          <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {result.pagination.page} of {result.pagination.totalPages} · {result.pagination.total} vouchers</span>
          <button className="btn btn-ghost" disabled={page >= result.pagination.totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
