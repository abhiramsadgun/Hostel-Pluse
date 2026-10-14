import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import { Shield, Building, AlertCircle, CheckCircle2, ArrowLeft, Info } from 'lucide-react';

export function WardenRegistration({ onBackToLogin }) {
  const [collegeIdNumber, setCollegeIdNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('male');
  const [blocks, setBlocks] = useState([]);
  const [blockId, setBlockId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isNightDeputy, setIsNightDeputy] = useState(false);
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successResult, setSuccessResult] = useState(null);

  useEffect(() => {
    async function loadBlocks() {
      try {
        const res = await api.get(`/auth/blocks?gender=${gender}`);
        if (res.success) {
          setBlocks(res.data);
          if (res.data.length > 0) setBlockId(res.data[0].id);
        }
      } catch (e) {}
    }
    loadBlocks();
  }, [gender]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/register/warden', {
        collegeIdNumber,
        fullName,
        email,
        phone,
        gender,
        blockId,
        isNightDeputy,
        password,
      });
      if (res.success) {
        setSuccessResult(res.data);
      }
    } catch (err) {
      if (err.details && Array.isArray(err.details)) {
        const detailMsg = err.details.map(d => `${d.field}: ${d.message}`).join('; ');
        setError(`${err.message} (${detailMsg})`);
      } else {
        setError(err.message || 'Warden registration failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (successResult) {
    return (
      <div style={{ maxWidth: '600px', margin: '3rem auto', padding: '0 1rem' }}>
        <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              margin: '0 auto 1.5rem',
              borderRadius: '50%',
              background: 'rgba(163, 146, 116, 0.15)',
              border: '2px solid var(--border-medium)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={36} color="var(--golden-wheat)" />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.75rem' }}>
            Warden Registration Recorded
          </h2>

          <div
            className={`badge ${successResult.warden?.status === 'active' ? 'badge-approved' : 'badge-pending'}`}
            style={{ marginBottom: '1.25rem', fontSize: '0.85rem', padding: '0.4rem 1rem' }}
          >
            Status: {successResult.warden?.status === 'active' ? 'Auto-Approved (Pre-loaded Roster)' : 'Pending Admin Confirmation'}
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            {successResult.message}
          </p>

          <button className="btn btn-primary" onClick={onBackToLogin} style={{ width: '100%', padding: '0.85rem' }}>
            Proceed to Login Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '640px', margin: '2rem auto', padding: '0 1rem' }}>
      <button onClick={onBackToLogin} className="btn btn-secondary btn-sm" style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={16} /> Back to Sign In
      </button>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.25rem' }}>
            Hostel Warden Sign-Up
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Register as a block warden. If your College ID is in the admin pre-loaded roster, you will be auto-approved immediately.
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">College ID Card Number *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. W-MALE-101"
                value={collegeIdNumber}
                onChange={e => setCollegeIdNumber(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Dr. Vikram Malhotra"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Warden Gender *</label>
              <select className="form-select" value={gender} onChange={e => setGender(e.target.value)} required>
                <option value="male">Male (Boys Hostel)</option>
                <option value="female">Female (Girls Hostel)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Assigned Hostel Block *</label>
              <select className="form-select" value={blockId} onChange={e => setBlockId(e.target.value)} required>
                {blocks.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Official College Email *</label>
              <input
                type="email"
                className="form-input"
                placeholder="warden@hostelpulse.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+91 9888800001"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.25rem' }}>
            <input
              type="checkbox"
              id="nightDeputy"
              checked={isNightDeputy}
              onChange={e => setIsNightDeputy(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent-indigo)', cursor: 'pointer' }}
            />
            <label htmlFor="nightDeputy" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Designate as Night / Deputy Warden for this block
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Password *</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter secure password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Register Warden Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
