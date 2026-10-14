import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import {
  Upload,
  User,
  Shield,
  Building,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  FileText,
  Image,
} from 'lucide-react';

export function StudentRegistration({ initialGender = 'male', onBackToLogin }) {
  const [gender, setGender] = useState(initialGender);
  const [blocks, setBlocks] = useState([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [laminatedIdNumber, setLaminatedIdNumber] = useState('');
  const [blockId, setBlockId] = useState('');
  const [className, setClassName] = useState('B.Tech CSE');
  const [academicYear, setAcademicYear] = useState('2');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [allergies, setAllergies] = useState('None');
  const [dietPreference, setDietPreference] = useState('veg');
  const [password, setPassword] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successResult, setSuccessResult] = useState(null);

  // Fetch blocks when gender changes
  useEffect(() => {
    async function loadBlocks() {
      setLoadingBlocks(true);
      try {
        const res = await api.get(`/auth/blocks?gender=${gender}`);
        if (res.success) {
          setBlocks(res.data);
          if (res.data.length > 0) {
            setBlockId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load blocks:', err);
      } finally {
        setLoadingBlocks(false);
      }
    }
    loadBlocks();
  }, [gender]);

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
      setError('Please upload a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds the 5MB limit.');
      return;
    }

    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError('Laminated hostel ID card photo is required for warden verification.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('fullName', fullName);
      formData.append('rollNumber', rollNumber);
      formData.append('laminatedIdNumber', laminatedIdNumber);
      formData.append('gender', gender);
      formData.append('blockId', blockId);
      formData.append('className', className);
      formData.append('academicYear', academicYear);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('parentName', parentName);
      formData.append('parentPhone', parentPhone);
      formData.append('emergencyContact', emergencyContact);
      formData.append('allergies', allergies || 'None');
      formData.append('dietPreference', dietPreference);
      formData.append('password', password);
      formData.append('idCardPhoto', selectedFile);

      const res = await api.post('/auth/register/student', formData);
      if (res.success) {
        setSuccessResult(res.data);
      }
    } catch (err) {
      if (err.details && Array.isArray(err.details)) {
        const detailMsg = err.details.map(d => `${d.field}: ${d.message}`).join('; ');
        setError(`${err.message} (${detailMsg})`);
      } else {
        setError(err.message || 'Registration failed. Please check for duplicate roll number, laminated ID, or email.');
      }
    } finally {
      setSubmitting(false);
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
              background: 'rgba(16, 185, 129, 0.15)',
              border: '2px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={36} color="#10b981" />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.75rem' }}>
            Registration Submitted Successfully!
          </h2>

          <div className="badge badge-pending" style={{ marginBottom: '1.25rem', fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
            Status: Pending Warden Verification
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            Thank you, <b>{fullName}</b>. Your registration with Laminated ID <b>{laminatedIdNumber}</b> has been routed to the Warden of your selected block. Once the warden verifies your ID card photo, your account will be activated and an email confirmation will be sent to <b>{email}</b>.
          </p>

          <button className="btn btn-primary" onClick={onBackToLogin} style={{ width: '100%', padding: '0.85rem' }}>
            Return to Login Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '720px', margin: '2rem auto', padding: '0 1rem' }}>
      <button
        onClick={onBackToLogin}
        className="btn btn-secondary btn-sm"
        style={{ marginBottom: '1.5rem' }}
      >
        <ArrowLeft size={16} /> Back to Sign In
      </button>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.25rem' }}>
              Hostel Student Registration
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Complete all details and upload your physical laminated hostel card
            </p>
          </div>

          {/* Gender Selector Toggle */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
            <button
              type="button"
              className={`btn btn-sm ${gender === 'male' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
              onClick={() => setGender('male')}
            >
              Boys Hostel
            </button>
            <button
              type="button"
              className={`btn btn-sm ${gender === 'female' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
              onClick={() => setGender('female')}
            >
              Girls Hostel
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Identity Section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--golden-wheat)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              1. Student Identity & Academic Details
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Roll / Registration Number *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 2024CSB101"
                  value={rollNumber}
                  onChange={e => setRollNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Laminated Hostel ID Number *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. HID-BBA-099"
                  value={laminatedIdNumber}
                  onChange={e => setLaminatedIdNumber(e.target.value)}
                  required
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Printed on the barcode of your laminated card
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Hostel Block ({gender}) *</label>
                <select
                  className="form-select"
                  value={blockId}
                  onChange={e => setBlockId(e.target.value)}
                  required
                  disabled={loadingBlocks}
                >
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
                <label className="form-label">Class / Degree Program *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. B.Tech Computer Science"
                  value={className}
                  onChange={e => setClassName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Academic Year *</label>
                <select
                  className="form-select"
                  value={academicYear}
                  onChange={e => setAcademicYear(e.target.value)}
                  required
                >
                  <option value="1">1st Year (Freshman)</option>
                  <option value="2">2nd Year (Sophomore)</option>
                  <option value="3">3rd Year (Junior)</option>
                  <option value="4">4th Year (Senior)</option>
                  <option value="5">5th Year (Postgraduate / Dual)</option>
                </select>
              </div>
            </div>

            {/* Default Mess Diet Preference */}
            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Default Mess Diet Preference *</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: 'normal' }}>
                  Can switch per meal each evening
                </span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button
                  type="button"
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: dietPreference === 'veg' ? '2px solid var(--golden-wheat)' : '1px solid var(--border-medium)',
                    background: dietPreference === 'veg' ? 'rgba(163, 146, 116, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                    color: dietPreference === 'veg' ? 'var(--golden-wheat)' : 'var(--soft-wheat)',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                  onClick={() => setDietPreference('veg')}
                >
                  🌱 Vegetarian (Default)
                </button>
                <button
                  type="button"
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: dietPreference === 'non_veg' ? '2px solid var(--golden-wheat)' : '1px solid var(--border-medium)',
                    background: dietPreference === 'non_veg' ? 'rgba(163, 146, 116, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                    color: dietPreference === 'non_veg' ? 'var(--golden-wheat)' : 'var(--soft-wheat)',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                  onClick={() => setDietPreference('non_veg')}
                >
                  🍗 Non-Vegetarian
                </button>
              </div>
            </div>
          </div>

          {/* Laminated ID Card Photo Upload with Duplicate Hash Detection */}
          <div style={{ marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--golden-wheat)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
              2. Photo of Physical Laminated Hostel ID Card *
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--soft-wheat)', marginBottom: '1rem' }}>
              Capture or upload a clear photo of your physical laminated card. The system validates image integrity and computes a cryptographic SHA-256 hash to reject duplicate uploads. Max size: 5MB.
            </p>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.25rem',
                  background: 'rgba(163, 146, 116, 0.15)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--golden-wheat)',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <Upload size={18} /> Choose ID Image File
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>

              {selectedFile && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Selected: <b>{selectedFile.name}</b> ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            {previewUrl && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Image Preview:</div>
                <img
                  src={previewUrl}
                  alt="Laminated ID Preview"
                  style={{ maxHeight: '180px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', objectFit: 'contain' }}
                />
              </div>
            )}
          </div>

          {/* Contact Details */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-cyan)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              3. Contact & Medical Information
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">College Email Address *</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="student@hostelpulse.edu"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Student Phone Number *</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+91 9876543210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Parent / Guardian Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ramesh Sharma"
                  value={parentName}
                  onChange={e => setParentName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Parent Phone Number *</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+91 9876543211"
                  value={parentPhone}
                  onChange={e => setParentPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Emergency Contact Number *</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="Relative / Local Guardian Phone"
                  value={emergencyContact}
                  onChange={e => setEmergencyContact(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Allergies / Medical Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Peanuts, Penicillin, None"
                  value={allergies}
                  onChange={e => setAllergies(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Account Password (min 6 characters) *</label>
              <input
                type="password"
                className="form-input"
                placeholder="Choose a strong password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.9rem', fontSize: '1rem' }}
            disabled={submitting}
          >
            {submitting ? 'Submitting Registration...' : 'Submit Hostel Registration for Approval'}
          </button>
        </form>
      </div>
    </div>
  );
}
