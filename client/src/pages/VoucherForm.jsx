import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import SignatureUpload from '../components/SignatureUpload';

export default function VoucherForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [draftId, setDraftId] = useState(id || null);
  const [meta, setMeta] = useState({ categories: [], departments: [] });
  const [f, setF] = useState({ department: user.department || '', title: '', category: 'Other', expenseDate: '', amount: '', description: '' });
  const [file, setFile] = useState(null);
  const [existingSig, setExistingSig] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverErr, setServerErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/meta').then(setMeta).catch((e) => setServerErr(e.message));
    if (!id) return;
    api.get(`/vouchers/${id}`).then((v) => {
      if (v.status !== 'Draft') return nav(`/vouchers/${id}`, { replace: true });
      setF({ department: v.department, title: v.title, category: v.category, expenseDate: v.expenseDate, amount: String(v.amount), description: v.description || '' });
      setExistingSig(v.employeeSignature);
    }).catch((e) => setServerErr(e.message));
  }, [id, nav]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function validate(forSubmit) {
    const e = {};
    if (!f.department) e.department = 'Department is required';
    if (!f.title.trim()) e.title = 'Expense title is required';
    if (!f.expenseDate) e.expenseDate = 'Expense date is required';
    if (f.amount === '') e.amount = 'Amount is required';
    else if (!(Number(f.amount) > 0)) e.amount = 'Amount must be greater than zero';
    if (forSubmit && !file && !existingSig && !user.signatureUrl) e.employeeSignature = 'Employee signature is required before submission';
    return e;
  }

  async function save(forSubmit) {
    const e = validate(forSubmit);
    setErrors(e);
    setServerErr('');
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('employeeSignature', file);
      const v = draftId
        ? await api.send('PUT', `/vouchers/${draftId}`, fd)
        : await api.send('POST', '/vouchers', fd);
      setDraftId(v.id);
      if (forSubmit) await api.post(`/vouchers/${v.id}/submit`);
      nav(`/vouchers/${v.id}`);
    } catch (err) {
      setServerErr(err.message);
      if (err.details) setErrors(err.details);
    } finally {
      setBusy(false);
    }
  }

  const err = (k) => errors[k] && <small className="error">{errors[k]}</small>;

  return (
    <>
      <div className="page-head"><h2>{id ? 'Edit draft voucher' : 'Create voucher'}</h2></div>
      <form className="card form-grid" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="field">
          <label>Department *</label>
          <select value={f.department} onChange={set('department')}>
            <option value="">Select department</option>
            {meta.departments.map((d) => <option key={d}>{d}</option>)}
          </select>{err('department')}
        </div>
        <div className="field">
          <label>Expense category</label>
          <select value={f.category} onChange={set('category')}>{meta.categories.map((c) => <option key={c}>{c}</option>)}</select>
          {err('category')}
        </div>
        <div className="field wide">
          <label>Expense title *</label>
          <input value={f.title} maxLength={200} onChange={set('title')} />{err('title')}
        </div>
        <div className="field">
          <label>Expense date *</label>
          <input type="date" value={f.expenseDate} onChange={set('expenseDate')} />{err('expenseDate')}
        </div>
        <div className="field">
          <label>Amount (₹) *</label>
          <input type="number" min="0" step="0.01" value={f.amount} onChange={set('amount')} />{err('amount')}
        </div>
        <div className="field wide">
          <label>Expense description</label>
          <textarea rows="4" value={f.description} onChange={set('description')} />
        </div>
        <div className="wide">
          <SignatureUpload
            label="Employee signature (required to submit)"
            file={file}
            existingUrl={existingSig}
            onChange={setFile}
            error={errors.employeeSignature}
            hint={!file && !existingSig && user.signatureUrl ? 'Your saved signature will be used if you don’t upload one.' : 'PNG, JPG or WEBP, up to 2MB.'}
          />
        </div>
        {serverErr && <p className="error wide" role="alert">{serverErr}</p>}
        <div className="form-actions wide">
          <button className="btn btn-ghost" disabled={busy} onClick={() => save(false)}>Save draft</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => save(true)}>Submit for approval</button>
        </div>
      </form>
    </>
  );
}
