import { useEffect, useState } from 'react';
import { fileUrl } from '../api';

const OK = ['image/png', 'image/jpeg', 'image/webp'];

export default function SignatureUpload({ label, file, existingUrl, onChange, error, hint }) {
  const [preview, setPreview] = useState(null);
  const [localErr, setLocalErr] = useState('');

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  function pick(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (!OK.includes(f.type)) return setLocalErr('Use a PNG, JPG or WEBP image.');
    if (f.size > 2 * 1024 * 1024) return setLocalErr('Image must be 2MB or smaller.');
    setLocalErr('');
    onChange(f);
  }

  const shown = preview || fileUrl(existingUrl);
  return (
    <div className="field">
      <label>{label}</label>
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} />
      {hint && <small className="muted">{hint}</small>}
      {shown && <img className="sig-preview" src={shown} alt="Signature preview" />}
      {(localErr || error) && <small className="error">{localErr || error}</small>}
    </div>
  );
}
