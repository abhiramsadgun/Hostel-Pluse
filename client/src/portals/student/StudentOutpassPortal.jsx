import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import { useAuth } from '../../shared/AuthContext';
import {
  Compass,
  QrCode,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  ShieldAlert,
  ArrowRight,
  Info,
  Phone,
  User,
  History,
  FileText,
  MapPin,
  ExternalLink,
} from 'lucide-react';

export function StudentOutpassPortal() {
  const { user } = useAuth();
  const student = user?.student;

  const [outpasses, setOutpasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal / Form state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedPassForQR, setSelectedPassForQR] = useState(null);

  // Form inputs
  const [type, setType] = useState('day');
  const [reason, setReason] = useState('');
  const [destination, setDestination] = useState('');
  const [outTime, setOutTime] = useState('');
  const [expectedReturnTime, setExpectedReturnTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Active filter
  const [activeFilter, setActiveFilter] = useState('all');

  async function fetchOutpasses() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/outpass');
      if (res.success) {
        setOutpasses(res.data.outpasses || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load outpass history.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOutpasses();
  }, []);

  // Compute monthly passes used (regular only, excluding emergency & rejected)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const regularMonthPasses = outpasses.filter(o => {
    const d = new Date(o.created_at);
    return (
      d.getMonth() === currentMonth &&
      d.getFullYear() === currentYear &&
      o.type !== 'emergency' &&
      !['Rejected', 'Cancelled'].includes(o.status)
    );
  }).length;

  const MAX_MONTHLY_PASSES = 4;
  const isQuotaExceeded = regularMonthPasses >= MAX_MONTHLY_PASSES;

  async function handleApplyOutpass(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      if (!outTime || !expectedReturnTime || !destination || !reason) {
        throw new Error('Please fill in all mandatory outpass fields.');
      }

      const outD = new Date(outTime);
      const retD = new Date(expectedReturnTime);

      if (retD <= outD) {
        throw new Error('Expected return time must be strictly after out time.');
      }

      if (type === 'day') {
        const retHour = retD.getHours();
        const retMin = retD.getMinutes();
        if (retHour > 21 || (retHour === 21 && retMin > 30)) {
          throw new Error('Day pass curfew is 9:30 PM. Please apply for a night or home pass.');
        }
      }

      if (type !== 'emergency' && isQuotaExceeded) {
        throw new Error(`Monthly quota of ${MAX_MONTHLY_PASSES} outpasses reached. Only emergency outpasses may be raised.`);
      }

      const res = await api.post('/outpass', {
        type,
        reason,
        destination,
        outTime,
        expectedReturnTime,
      });

      if (res.success) {
        setSuccessMsg(`Outpass request submitted successfully (${res.data.outpassNumber}). Warden notified for parental verification.`);
        setShowApplyModal(false);
        // Reset form
        setReason('');
        setDestination('');
        setOutTime('');
        setExpectedReturnTime('');
        fetchOutpasses();
      }
    } catch (err) {
      setFormError(err.message || 'Failed to submit outpass request.');
    } finally {
      setSubmitting(false);
    }
  }

  const getStatusBadge = (status, isLate) => {
    if (isLate || status === 'Overdue') {
      return (
        <span
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            border: '1px solid #ef4444',
            padding: '0.25rem 0.65rem',
            borderRadius: '9999px',
            fontSize: '0.72rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          <AlertTriangle size={12} /> Overdue / Late
        </span>
      );
    }
    switch (status) {
      case 'Requested':
        return (
          <span
            style={{
              background: 'rgba(217, 119, 6, 0.18)',
              color: '#fbbf24',
              border: '1px solid rgba(217, 119, 6, 0.4)',
              padding: '0.25rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
            }}
          >
            Requested
          </span>
        );
      case 'Parent Contacted':
        return (
          <span
            style={{
              background: 'rgba(59, 130, 246, 0.18)',
              color: '#93c5fd',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              padding: '0.25rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
            }}
          >
            Parent Contacted
          </span>
        );
      case 'Approved':
        return (
          <span
            style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              padding: '0.25rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <CheckCircle size={12} /> Approved
          </span>
        );
      case 'Out':
        return (
          <span
            style={{
              background: 'rgba(163, 146, 116, 0.25)',
              color: 'var(--golden-wheat)',
              border: '1px solid var(--golden-wheat)',
              padding: '0.25rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
            }}
          >
            Checked Out (Off Campus)
          </span>
        );
      case 'Returned':
        return (
          <span
            style={{
              background: 'rgba(107, 114, 128, 0.2)',
              color: 'var(--soft-wheat)',
              border: '1px solid var(--border-medium)',
              padding: '0.25rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
            }}
          >
            Returned
          </span>
        );
      case 'Rejected':
        return (
          <span
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '0.25rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
            }}
          >
            Rejected
          </span>
        );
      default:
        return <span className="flat-badge">{status}</span>;
    }
  };

  const filteredPasses = outpasses.filter(o => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return ['Requested', 'Parent Contacted', 'Approved', 'Out'].includes(o.status);
    if (activeFilter === 'history') return ['Returned', 'Rejected', 'Cancelled'].includes(o.status);
    if (activeFilter === 'overdue') return o.status === 'Overdue' || o.is_late_return;
    return true;
  });

  return (
    <div style={{ maxWidth: '1150px', margin: '1.5rem auto', padding: '0 1rem' }}>
      {/* Top Banner */}
      <div className="photo-hero-banner" style={{ minHeight: '190px', marginBottom: '1.75rem' }}>
        <img
          src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80"
          alt="Student Life and Campus Gate"
          className="photo-hero-image"
        />
        <div className="photo-hero-overlay">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>
                  Smart Gate Clearance
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                  DIGITAL OUTPASS &amp; SAFETY SYSTEM
                </span>
              </div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginBottom: '0.25rem' }}>
                Hostel Outpass &amp; Leaves
              </h1>
              <p style={{ color: 'var(--soft-wheat)', fontSize: '0.88rem' }}>
                Apply for day leaves, weekend visits, or emergency exits. Digital QR clearance at security gates.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {/* Monthly Quota Indicator */}
              <div
                style={{
                  background: 'var(--deep-gray)',
                  border: '1px solid var(--border-medium)',
                  borderTop: isQuotaExceeded ? '3px solid #ef4444' : '3px solid var(--golden-wheat)',
                  padding: '0.65rem 1.1rem',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Monthly Quota
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: '800', color: isQuotaExceeded ? '#f87171' : 'var(--golden-wheat)' }}>
                  {regularMonthPasses} / {MAX_MONTHLY_PASSES}
                </div>
                <div style={{ fontSize: '0.65rem', color: isQuotaExceeded ? '#f87171' : 'var(--soft-wheat)' }}>
                  {isQuotaExceeded ? 'Quota Exceeded' : `${MAX_MONTHLY_PASSES - regularMonthPasses} remaining`}
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => setShowApplyModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.75rem 1.25rem' }}
              >
                <Plus size={18} /> Apply New Outpass
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Notices */}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={18} /> {successMsg}
          </div>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* Rules Pill Bar */}
      <div
        className="flat-card"
        style={{
          padding: '0.9rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.5rem',
          alignItems: 'center',
          fontSize: '0.82rem',
          color: 'var(--soft-wheat)',
          background: 'var(--deep-gray)',
          borderLeft: '4px solid var(--golden-wheat)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Clock size={16} color="var(--golden-wheat)" />
          <span><strong>Day Curfew:</strong> Returns mandatory before <strong>9:30 PM</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Phone size={16} color="var(--golden-wheat)" />
          <span><strong>Parent Verification:</strong> Warden call required prior to regular approval</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ShieldAlert size={16} color="#ef4444" />
          <span><strong>Emergency:</strong> Bypasses parent call requirement for rapid medical exit</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-medium)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn btn-sm ${activeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveFilter('all')}
        >
          All Passes ({outpasses.length})
        </button>
        <button
          className={`btn btn-sm ${activeFilter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveFilter('active')}
        >
          Active / In Review ({outpasses.filter(o => ['Requested', 'Parent Contacted', 'Approved', 'Out'].includes(o.status)).length})
        </button>
        <button
          className={`btn btn-sm ${activeFilter === 'history' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveFilter('history')}
        >
          Completed History ({outpasses.filter(o => ['Returned', 'Rejected', 'Cancelled'].includes(o.status)).length})
        </button>
      </div>

      {/* Outpasses List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--soft-wheat)' }}>
          <div className="brand-icon" style={{ margin: '0 auto 1rem', width: '48px', height: '48px' }}>
            <Compass size={24} color="#191918" />
          </div>
          <div>Loading outpasses &amp; clearance status...</div>
        </div>
      ) : filteredPasses.length === 0 ? (
        <div className="flat-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <Compass size={36} color="var(--golden-wheat)" style={{ marginBottom: '0.75rem', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.35rem' }}>No outpass records found</h3>
          <p style={{ color: 'var(--soft-wheat)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            You haven't requested any outpass in this category yet.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => setShowApplyModal(true)}>
            Apply for Outpass
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredPasses.map(op => {
            const isApproved = op.status === 'Approved' || op.status === 'Out';
            const isOut = op.status === 'Out';
            const isOverdue = op.status === 'Overdue' || op.is_late_return;

            return (
              <div
                key={op.id}
                className="flat-card"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderLeft: isOverdue
                    ? '4px solid #ef4444'
                    : isApproved
                    ? '4px solid #10b981'
                    : '4px solid var(--golden-wheat)',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  {/* Left: Basic Info */}
                  <div style={{ flex: '1 1 350px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: '800',
                          fontSize: '0.95rem',
                          color: 'var(--golden-wheat)',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {op.outpass_number}
                      </span>
                      <span className="flat-wheat-badge" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                        {op.type} Pass
                      </span>
                      {getStatusBadge(op.status, op.is_late_return)}
                    </div>

                    <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      Destination: {op.destination}
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                      <strong>Reason:</strong> {op.reason}
                    </p>

                    {/* Schedule times */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '0.65rem',
                        fontSize: '0.8rem',
                        background: 'rgba(0,0,0,0.25)',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>OUT TIME</div>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                          {new Date(op.out_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                        {op.actual_out_time && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--golden-wheat)' }}>
                            Actual Gate Exit: {new Date(op.actual_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>

                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>EXPECTED RETURN</div>
                        <div style={{ fontWeight: '600', color: isOverdue ? '#f87171' : 'var(--text-primary)' }}>
                          {new Date(op.expected_return_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                        {op.actual_return_time && (
                          <div style={{ fontSize: '0.7rem', color: op.is_late_return ? '#f87171' : '#34d399' }}>
                            Actual Gate Entry: {new Date(op.actual_return_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Parent Verification & Action */}
                  <div style={{ minWidth: '220px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
                    {/* Parent call status card */}
                    <div
                      style={{
                        background: 'var(--deep-gray)',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-medium)',
                        fontSize: '0.75rem',
                        width: '100%',
                      }}
                    >
                      <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>PARENT VERIFICATION</div>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        {op.parent_name || student?.parentName} ({op.parent_phone || student?.parentPhone})
                      </div>
                      <div style={{ marginTop: '0.25rem', color: 'var(--golden-wheat)', fontWeight: '600' }}>
                        Status: {op.parent_consent_status}
                      </div>
                    </div>

                    {/* QR Code Action Button if Approved / Out */}
                    {isApproved && op.qr_code_data && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setSelectedPassForQR(op)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', justifyContent: 'center' }}
                      >
                        <QrCode size={16} /> View Digital Gate Pass
                      </button>
                    )}

                    {op.status === 'Requested' && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)', textAlign: 'right' }}>
                        <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        Awaiting warden review &amp; parent verification call
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Apply Outpass Modal */}
      {showApplyModal && (
        <div className="modal-backdrop">
          <div className="modal-content flat-card" style={{ maxWidth: '580px', width: '92%', border: '1px solid var(--golden-wheat)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Official Request</span>
                <h2 style={{ fontSize: '1.35rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginTop: '0.2rem' }}>
                  Apply for Hostel Outpass
                </h2>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--soft-wheat)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                <AlertTriangle size={16} /> {formError}
              </div>
            )}

            <form onSubmit={handleApplyOutpass}>
              {/* Outpass Type */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Outpass Type *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  {[
                    { id: 'day', label: 'Day Pass', sub: 'Before 9:30 PM' },
                    { id: 'night', label: 'Night Stay', sub: 'Single night' },
                    { id: 'home', label: 'Home Visit', sub: 'Multi-day leave' },
                    { id: 'emergency', label: 'Emergency', sub: 'Immediate exit' },
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setType(item.id)}
                      style={{
                        background: type === item.id ? 'var(--golden-wheat)' : 'var(--deep-gray)',
                        color: type === item.id ? '#191918' : 'var(--soft-wheat)',
                        border: type === item.id ? '1px solid var(--golden-wheat)' : '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.6rem 0.4rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ fontWeight: '800', fontSize: '0.82rem' }}>{item.label}</div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>{item.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Destination */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Destination Address / City *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. City Central Mall / Hometown Residence, Hyderabad"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  required
                />
              </div>

              {/* Reason */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Purpose / Reason *</label>
                <textarea
                  className="form-input"
                  rows="2"
                  placeholder="Specify the exact purpose for campus leave..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  required
                />
              </div>

              {/* Dates grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '700' }}>Out Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={outTime}
                    onChange={e => setOutTime(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '700' }}>Expected Return Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={expectedReturnTime}
                    onChange={e => setExpectedReturnTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Parent Info Preview */}
              <div
                style={{
                  background: 'var(--deep-gray)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  marginBottom: '1.25rem',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>PARENT CONTACT ON FILE</div>
                <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                  {student?.parentName || 'Primary Parent / Guardian'} &bull; {student?.parentPhone || 'Phone Registered'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--soft-wheat)', marginTop: '0.2rem' }}>
                  {type === 'emergency'
                    ? 'Emergency passes waive mandatory parent pre-call, but SMS notification will be dispatched instantly.'
                    : 'The warden will dial this phone number to record parental consent prior to issuance.'}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowApplyModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {submitting ? 'Validating...' : 'Submit Outpass Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Digital QR Modal */}
      {selectedPassForQR && (
        <div className="modal-backdrop">
          <div
            className="modal-content flat-card"
            style={{
              maxWidth: '440px',
              width: '92%',
              border: '2px solid var(--golden-wheat)',
              textAlign: 'center',
              padding: '2rem 1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span className="flat-wheat-badge" style={{ fontSize: '0.72rem' }}>Official Digital Gate Pass</span>
              <button
                onClick={() => setSelectedPassForQR(null)}
                style={{ background: 'none', border: 'none', color: 'var(--soft-wheat)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginBottom: '0.35rem' }}>
              {selectedPassForQR.student_name || student?.fullName || user?.fullName}
            </h2>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--golden-wheat)', fontWeight: '800', fontSize: '1.15rem', marginBottom: '1.25rem' }}>
              {selectedPassForQR.outpass_number}
            </div>

            {/* QR Code Container */}
            <div
              style={{
                background: '#ffffff',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                display: 'inline-block',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                marginBottom: '1.25rem',
              }}
            >
              <img
                src={selectedPassForQR.qr_code_data}
                alt="Gate QR Code"
                style={{ width: '220px', height: '220px', display: 'block' }}
              />
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--soft-wheat)', marginBottom: '1.25rem', textAlign: 'left', background: 'var(--deep-gray)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)' }}>
              <div><strong>Pass Type:</strong> {selectedPassForQR.type?.toUpperCase()} PASS</div>
              <div><strong>Destination:</strong> {selectedPassForQR.destination}</div>
              <div><strong>Valid Until:</strong> {new Date(selectedPassForQR.expected_return_time).toLocaleString()}</div>
              <div><strong>Approved By:</strong> Warden Authority</div>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Present this QR code to the campus security guard at the gate for electronic check-out and check-in.
            </p>

            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setSelectedPassForQR(null)}>
              Close Pass
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
