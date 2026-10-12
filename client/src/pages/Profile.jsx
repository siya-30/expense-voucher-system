import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import SignatureUpload from '../components/SignatureUpload';
import { ROLE_LABEL } from '../utils';

export default function Profile() {
  const { user, refresh } = useAuth();
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!file) return setError('Choose an image first.');
    setBusy(true); setError(''); setMsg('');
    try {
      const fd = new FormData();
      fd.append('signature', file);
      await api.send('POST', '/auth/signature', fd);
      await refresh();
      setFile(null);
      setMsg('Signature saved.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head"><h2>My signature</h2></div>
      <div className="card narrow">
        <p><strong>{user.name}</strong> · {ROLE_LABEL[user.role]}{user.employeeCode ? ` · ${user.employeeCode}` : ''}</p>
        <p className="muted">
          {user.role === 'EMPLOYEE'
            ? 'A saved signature is attached automatically to new vouchers.'
            : 'A saved signature is used automatically when you approve a voucher without uploading a new one.'}
        </p>
        <SignatureUpload label="Signature image" file={file} existingUrl={user.signatureUrl} onChange={setFile} hint="PNG, JPG or WEBP, up to 2MB." />
        {error && <p className="error">{error}</p>}
        {msg && <p className="success">{msg}</p>}
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save signature'}</button>
      </div>
    </>
  );
}
