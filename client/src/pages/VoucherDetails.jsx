import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fileUrl } from '../api';
import { useAuth } from '../auth';
import SignatureUpload from '../components/SignatureUpload';
import StatusBadge from '../components/StatusBadge';
import { fmtDate, fmtDateTime, money } from '../utils';

const Row = ({ label, children }) => (
  <div className="row"><dt>{label}</dt><dd>{children || '—'}</dd></div>
);

export default function VoucherDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [v, setV] = useState(null);
  const [error, setError] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [panel, setPanel] = useState(null);
  const [file, setFile] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get(`/vouchers/${id}`).then(setV).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  async function run(fn) {
    setBusy(true); setActionErr('');
    try { await fn(); } catch (e) { setActionErr(e.message); } finally { setBusy(false); }
  }

  const approve = () => {
    if (!file && !user.signatureUrl) return setActionErr('Upload your signature before approving.');
    run(async () => {
      const fd = new FormData();
      if (file) fd.append('signature', file);
      await api.send('POST', `/vouchers/${id}/approve`, fd);
      setPanel(null); setFile(null); load();
    });
  };
  const reject = () => {
    if (!reason.trim()) return setActionErr('Enter a rejection reason.');
    run(async () => { await api.post(`/vouchers/${id}/reject`, { reason }); setPanel(null); setReason(''); load(); });
  };
  const submit = () => run(async () => { await api.post(`/vouchers/${id}/submit`); load(); });
  const remove = () => {
    if (!window.confirm('Delete this draft voucher? This cannot be undone.')) return;
    run(async () => { await api.del(`/vouchers/${id}`); nav('/vouchers'); });
  };

  if (error) return <><p className="error">{error}</p><Link to="/vouchers">Back to vouchers</Link></>;
  if (!v) return <p className="center-note">Loading…</p>;

  const isOwnerDraft = user.role === 'EMPLOYEE' && v.status === 'Draft';
  const canDecide = user.role === 'DIRECTOR' && v.status === 'Pending Approval';

  return (
    <>
      <div className="page-head no-print">
        <h2>{v.voucherNumber} <StatusBadge status={v.status} /></h2>
        <div className="actions">
          <button className="btn btn-ghost" onClick={() => window.print()}>Print</button>
          {isOwnerDraft && <>
            <Link className="btn btn-ghost" to={`/vouchers/${v.id}/edit`}>Edit</Link>
            <button className="btn btn-ghost danger" disabled={busy} onClick={remove}>Delete</button>
            <button className="btn btn-primary" disabled={busy} onClick={submit}>Submit for approval</button>
          </>}
          {canDecide && <>
            <button className="btn btn-ghost danger" onClick={() => { setPanel('reject'); setActionErr(''); }}>Reject</button>
            <button className="btn btn-primary" onClick={() => { setPanel('approve'); setActionErr(''); }}>Approve</button>
          </>}
        </div>
      </div>

      {actionErr && <p className="error" role="alert">{actionErr}{actionErr.includes('signature') && isOwnerDraft ? ' Edit the draft to add one.' : ''}</p>}

      {v.status === 'Rejected' && (
        <div className="callout callout-danger"><strong>Rejected by {v.directorName}.</strong> Reason: {v.rejectionReason}</div>
      )}

      {panel === 'approve' && (
        <div className="card no-print">
          <h3>Approve voucher</h3>
          <SignatureUpload label="Director signature" file={file} existingUrl={user.signatureUrl} onChange={setFile}
            hint={user.signatureUrl && !file ? 'Your saved signature will be used. Upload a new one to replace it.' : 'Required to approve.'} />
          <div className="actions">
            <button className="btn btn-ghost" onClick={() => setPanel(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={approve}>Confirm approval</button>
          </div>
        </div>
      )}
      {panel === 'reject' && (
        <div className="card no-print">
          <h3>Reject voucher</h3>
          <div className="field"><label>Rejection reason *</label>
            <textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <div className="actions">
            <button className="btn btn-ghost" onClick={() => setPanel(null)}>Cancel</button>
            <button className="btn btn-danger" disabled={busy} onClick={reject}>Confirm rejection</button>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Voucher details</h3>
        <dl className="details">
          <Row label="Voucher number">{v.voucherNumber}</Row>
          <Row label="Voucher date">{fmtDate(v.voucherDate)}</Row>
          <Row label="Expense date">{fmtDate(v.expenseDate)}</Row>
          <Row label="Department">{v.department}</Row>
          <Row label="Expense title">{v.title}</Row>
          <Row label="Category">{v.category}</Row>
          <Row label="Amount"><strong>{money(v.amount)}</strong></Row>
          <Row label="Description">{v.description}</Row>
        </dl>
      </div>

      <div className="card">
        <h3>Employee</h3>
        <dl className="details">
          <Row label="Name">{v.employeeName}</Row>
          <Row label="Employee ID">{v.employeeCode}</Row>
          <Row label="Signature">{v.employeeSignature && <img className="sig" src={fileUrl(v.employeeSignature)} alt="Employee signature" />}</Row>
        </dl>
      </div>

      <div className="card">
        <h3>Approval</h3>
        <dl className="details">
          <Row label="Current status"><StatusBadge status={v.status} /></Row>
          <Row label="Director">{v.directorName}</Row>
          <Row label="Approval date">{v.approvalDate && fmtDateTime(v.approvalDate)}</Row>
          <Row label="Director signature">{v.directorSignature && <img className="sig" src={fileUrl(v.directorSignature)} alt="Director signature" />}</Row>
          {v.rejectionReason && <Row label="Rejection reason">{v.rejectionReason}</Row>}
        </dl>
      </div>

      <div className="card">
        <h3>Audit</h3>
        <dl className="details">
          <Row label="Created">{fmtDateTime(v.createdAt)}</Row>
          <Row label="Last updated">{fmtDateTime(v.updatedAt)}</Row>
        </dl>
        <ol className="timeline">
          {v.history.map((h) => (
            <li key={h.id}>
              <strong>{h.to}</strong> · {fmtDateTime(h.at)}{h.actor ? ` · ${h.actor}` : ''}
              {h.note && <div className="muted small">{h.note}</div>}
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
