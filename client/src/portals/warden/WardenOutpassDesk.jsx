import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import { useAuth } from '../../shared/AuthContext';
import {
  Compass,
  Phone,
  PhoneCall,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Shield,
  FileText,
  Calendar,
  AlertOctagon,
  Search,
  Check,
  X,
  History,
} from 'lucide-react';

export function WardenOutpassDesk() {
  const { user } = useAuth();
  const [outpasses, setOutpasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'all' | 'Requested' | 'Parent Contacted' | 'Overdue'
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Call Log Modal State
  const [activeCallModalPass, setActiveCallModalPass] = useState(null);
  const [contactPerson, setContactPerson] = useState('');
  const [phoneDialed, setPhoneDialed] = useState('');
  const [callResponse, setCallResponse] = useState('consent_granted');
  const [callNotes, setCallNotes] = useState('');
  const [submittingCall, setSubmittingCall] = useState(false);

  // Decision Modal (Approval / Rejection)
  const [activeDecisionModalPass, setActiveDecisionModalPass] = useState(null);
  const [decisionAction, setDecisionAction] = useState('approve'); // 'approve' | 'reject'
  const [wardenNotes, setWardenNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState(null);

  // Details Modal (Audit + Call Logs + Gate Logs)
  const [detailsData, setDetailsData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  async function fetchOutpasses() {
    setLoading(true);
    setError(null);
    try {
      const queryStatus = statusFilter === 'active' ? '' : statusFilter;
      const res = await api.get(`/outpass?status=${queryStatus}&type=${typeFilter}`);
      if (res.success) {
        setOutpasses(res.data.outpasses || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch outpass requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOutpasses();
  }, [statusFilter, typeFilter]);

  // Open Log Call Modal
  function handleOpenCallModal(pass) {
    setActiveCallModalPass(pass);
    setContactPerson(pass.parent_name || 'Parent / Guardian');
    setPhoneDialed(pass.parent_phone || pass.student_phone || '');
    setCallResponse('consent_granted');
    setCallNotes('');
  }

  async function handleSubmitCallLog(e) {
    e.preventDefault();
    if (!activeCallModalPass) return;
    setSubmittingCall(true);

    try {
      const res = await api.post(`/outpass/${activeCallModalPass.id}/call-log`, {
        contactPerson,
        phoneDialed,
        responseStatus: callResponse,
        notes: callNotes,
      });

      if (res.success) {
        setSuccessMsg(`Call log recorded for ${activeCallModalPass.student_name}. Status updated to 'Parent Contacted'.`);
        setActiveCallModalPass(null);
        fetchOutpasses();
      }
    } catch (err) {
      alert(err.message || 'Failed to save parental call log.');
    } finally {
      setSubmittingCall(false);
    }
  }

  // Open Decision Modal
  function handleOpenDecisionModal(pass, action) {
    setActiveDecisionModalPass(pass);
    setDecisionAction(action);
    setWardenNotes('');
    setRejectionReason('');
    setDecisionError(null);
  }

  async function handleConfirmDecision(e) {
    e.preventDefault();
    if (!activeDecisionModalPass) return;
    setSubmittingDecision(true);
    setDecisionError(null);

    try {
      const res = await api.put(`/outpass/${activeDecisionModalPass.id}/decision`, {
        decision: decisionAction === 'approve' ? 'APPROVE' : 'REJECT',
        wardenNotes,
        rejectionReason: decisionAction === 'reject' ? rejectionReason : undefined,
      });

      if (res.success) {
        setSuccessMsg(
          decisionAction === 'approve'
            ? `Outpass ${res.data.outpassNumber} APPROVED. QR gate clearance issued.`
            : `Outpass REJECTED.`
        );
        setActiveDecisionModalPass(null);
        fetchOutpasses();
      }
    } catch (err) {
      setDecisionError(err.message || 'Decision failed.');
    } finally {
      setSubmittingDecision(false);
    }
  }

  // View full outpass trail
  async function handleViewDetails(id) {
    setLoadingDetails(true);
    try {
      const res = await api.get(`/outpass/${id}`);
      if (res.success) {
        setDetailsData(res.data);
      }
    } catch (err) {
      alert('Could not fetch outpass history details.');
    } finally {
      setLoadingDetails(false);
    }
  }

  // Filtered in-memory list
  const filteredList = outpasses.filter(op => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = op.student_name?.toLowerCase().includes(term);
      const matchRoll = op.student_roll?.toLowerCase().includes(term);
      const matchNum = op.outpass_number?.toLowerCase().includes(term);
      const matchDest = op.destination?.toLowerCase().includes(term);
      if (!matchName && !matchRoll && !matchNum && !matchDest) return false;
    }
    if (statusFilter === 'active') {
      return ['Requested', 'Parent Contacted', 'Approved', 'Out', 'Overdue'].includes(op.status);
    }
    return true;
  });

  // Overview stats
  const pendingCallsCount = outpasses.filter(o => o.status === 'Requested').length;
  const readyForDecisionCount = outpasses.filter(o => o.status === 'Parent Contacted' || (o.status === 'Requested' && o.type === 'emergency')).length;
  const offCampusCount = outpasses.filter(o => o.status === 'Out').length;
  const overdueCount = outpasses.filter(o => o.status === 'Overdue' || o.is_late_return).length;

  return (
    <div style={{ maxWidth: '1200px', margin: '1.5rem auto', padding: '0 1rem' }}>
      {/* Top Banner */}
      <div className="photo-hero-banner" style={{ minHeight: '190px', marginBottom: '1.75rem' }}>
        <img
          src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80"
          alt="Warden Administration Desk"
          className="photo-hero-image"
        />
        <div className="photo-hero-overlay">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>
                  Warden Authority Control
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                  CAMPUS MOVEMENT &amp; SAFETY VERIFICATION
                </span>
              </div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginBottom: '0.25rem' }}>
                Hostel Outpass Desk
              </h1>
              <p style={{ color: 'var(--soft-wheat)', fontSize: '0.88rem' }}>
                Verify parental consent, review campus leave requests, and issue digital QR passes for your hostel block.
              </p>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div
                style={{
                  background: 'var(--deep-gray)',
                  border: '1px solid var(--border-medium)',
                  borderTop: '3px solid #fbbf24',
                  padding: '0.65rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Need Call</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#fbbf24' }}>{pendingCallsCount}</div>
              </div>
              <div
                style={{
                  background: 'var(--deep-gray)',
                  border: '1px solid var(--border-medium)',
                  borderTop: '3px solid var(--golden-wheat)',
                  padding: '0.65rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Off Campus</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--golden-wheat)' }}>{offCampusCount}</div>
              </div>
              <div
                style={{
                  background: 'var(--deep-gray)',
                  border: '1px solid var(--border-medium)',
                  borderTop: '3px solid #ef4444',
                  padding: '0.65rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overdue</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: overdueCount > 0 ? '#f87171' : 'var(--soft-wheat)' }}>
                  {overdueCount}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
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

      {/* Filter and Search Bar */}
      <div
        className="flat-card"
        style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${statusFilter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('active')}
          >
            Active Queue ({pendingCallsCount + readyForDecisionCount + offCampusCount})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === 'Requested' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('Requested')}
          >
            Pending Call Log ({pendingCallsCount})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('all')}
          >
            All Passes
          </button>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '260px' }}>
          <Search size={16} color="var(--golden-wheat)" />
          <input
            type="text"
            className="form-input"
            placeholder="Search student, roll no, or pass ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Outpass List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--soft-wheat)' }}>
          <div className="brand-icon" style={{ margin: '0 auto 1rem', width: '48px', height: '48px' }}>
            <Compass size={24} color="#191918" />
          </div>
          <div>Loading warden review queue...</div>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="flat-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <CheckCircle size={36} color="var(--golden-wheat)" style={{ marginBottom: '0.75rem', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.35rem' }}>Queue is Clear</h3>
          <p style={{ color: 'var(--soft-wheat)', fontSize: '0.85rem' }}>
            No outpass requests requiring action in this view.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredList.map(op => {
            const hasCallLogs = parseInt(op.call_log_count, 10) > 0;
            const isEmergency = op.type === 'emergency';
            const canApprove = hasCallLogs || isEmergency;
            const isOverdue = op.status === 'Overdue' || op.is_late_return;

            return (
              <div
                key={op.id}
                className="flat-card"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderLeft: isEmergency
                    ? '4px solid #ef4444'
                    : isOverdue
                    ? '4px solid #ef4444'
                    : op.status === 'Approved'
                    ? '4px solid #10b981'
                    : op.status === 'Parent Contacted'
                    ? '4px solid #3b82f6'
                    : '4px solid var(--golden-wheat)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
                  {/* Student & Outpass Details */}
                  <div style={{ flex: '1 1 380px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: '800',
                          fontSize: '0.95rem',
                          color: 'var(--golden-wheat)',
                        }}
                      >
                        {op.outpass_number}
                      </span>
                      <span className="flat-wheat-badge" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                        {op.type} pass
                      </span>
                      {isEmergency && (
                        <span
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            border: '1px solid #ef4444',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.7rem',
                            fontWeight: '800',
                          }}
                        >
                          EMERGENCY (WAIVES PARENT CALL)
                        </span>
                      )}
                      <span className="flat-badge" style={{ fontSize: '0.7rem' }}>
                        Status: {op.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {op.student_name} &bull; Room {op.room_number || 'N/A'} ({op.block_name})
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--soft-wheat)', marginBottom: '0.5rem' }}>
                      Roll No: <span style={{ fontFamily: 'var(--font-mono)' }}>{op.student_roll}</span> &bull; Student Phone: {op.student_phone}
                    </div>

                    <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      <strong>Destination:</strong> {op.destination}
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--soft-wheat)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                      <strong>Reason:</strong> {op.reason}
                    </p>

                    {/* Window Timing */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '1.5rem',
                        fontSize: '0.78rem',
                        background: 'rgba(0,0,0,0.25)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        maxWidth: '500px',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>OUT:</span>{' '}
                        <strong>{new Date(op.out_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>RETURN:</span>{' '}
                        <strong style={{ color: isOverdue ? '#f87171' : 'var(--text-primary)' }}>
                          {new Date(op.expected_return_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* PROMINENT PARENT CONTACT CARD */}
                  <div
                    style={{
                      background: 'var(--deep-gray)',
                      border: '1px solid var(--border-medium)',
                      borderTop: hasCallLogs ? '3px solid #10b981' : '3px solid #fbbf24',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      minWidth: '300px',
                      flex: '0 1 320px',
                    }}
                  >
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                      Mandatory Parental Verification
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                      {op.parent_name || 'Parent Contact'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: '700', color: 'var(--golden-wheat)', marginBottom: '0.5rem' }}>
                      <Phone size={16} />
                      <a href={`tel:${op.parent_phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {op.parent_phone || 'No phone recorded'}
                      </a>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)', marginBottom: '0.75rem' }}>
                      Calls Logged: <strong>{op.call_log_count || 0}</strong> &bull; Consent: <strong>{op.parent_consent_status}</strong>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {/* Log Call Button */}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenCallModal(op)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: '100%' }}
                      >
                        <PhoneCall size={14} color="var(--golden-wheat)" /> Log Parent Call
                      </button>

                      {/* Approve / Reject buttons if pending */}
                      {['Requested', 'Parent Contacted'].includes(op.status) && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={!canApprove}
                            onClick={() => handleOpenDecisionModal(op, 'approve')}
                            title={!canApprove ? 'Must log parent call first before approving' : 'Approve outpass and generate QR'}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.3rem',
                              opacity: !canApprove ? 0.5 : 1,
                              cursor: !canApprove ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenDecisionModal(op, 'reject')}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: '#f87171' }}
                          >
                            <X size={14} /> Reject
                          </button>
                        </div>
                      )}

                      {/* Details / History */}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleViewDetails(op.id)}
                        style={{ fontSize: '0.72rem', padding: '0.3rem 0.5rem' }}
                      >
                        View Verification History
                      </button>
                    </div>

                    {!canApprove && ['Requested', 'Parent Contacted'].includes(op.status) && (
                      <div style={{ fontSize: '0.68rem', color: '#fbbf24', marginTop: '0.45rem', textAlign: 'center' }}>
                        ⚠️ Approval locked until parent call is logged
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Call Log Modal */}
      {activeCallModalPass && (
        <div className="modal-backdrop">
          <div className="modal-content flat-card" style={{ maxWidth: '520px', width: '92%', border: '1px solid var(--golden-wheat)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Telephone Audit Trail</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginTop: '0.2rem' }}>
                  Record Parent Verification Call
                </h2>
              </div>
              <button
                onClick={() => setActiveCallModalPass(null)}
                style={{ background: 'none', border: 'none', color: 'var(--soft-wheat)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', marginBottom: '1rem' }}>
              Student: <strong>{activeCallModalPass.student_name}</strong> &bull; Destination: <strong>{activeCallModalPass.destination}</strong>
            </p>

            <form onSubmit={handleSubmitCallLog}>
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Contact Person *</label>
                <input
                  type="text"
                  className="form-input"
                  value={contactPerson}
                  onChange={e => setContactPerson(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Phone Number Dialed *</label>
                <input
                  type="text"
                  className="form-input"
                  value={phoneDialed}
                  onChange={e => setPhoneDialed(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Parental Response / Outcome *</label>
                <select
                  className="form-input"
                  value={callResponse}
                  onChange={e => setCallResponse(e.target.value)}
                  required
                >
                  <option value="consent_granted">Consent Granted (Parent Approved Outpass)</option>
                  <option value="consent_denied">Consent Denied (Parent Refused Permission)</option>
                  <option value="no_answer">No Answer / Switched Off</option>
                  <option value="requested_callback">Parent Requested Callback Later</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Call Notes / Conversation Summary</label>
                <textarea
                  className="form-input"
                  rows="3"
                  placeholder="e.g. Spoke to student's father Mr. Ramesh. Confirmed travel to family function in hometown."
                  value={callNotes}
                  onChange={e => setCallNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveCallModalPass(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingCall}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {submittingCall ? 'Saving Log...' : 'Save Call Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decision Modal (Approve / Reject) */}
      {activeDecisionModalPass && (
        <div className="modal-backdrop">
          <div className="modal-content flat-card" style={{ maxWidth: '500px', width: '92%', border: '1px solid var(--golden-wheat)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Official Determination</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginTop: '0.2rem' }}>
                  {decisionAction === 'approve' ? 'Approve Outpass & Issue QR' : 'Reject Outpass Request'}
                </h2>
              </div>
              <button
                onClick={() => setActiveDecisionModalPass(null)}
                style={{ background: 'none', border: 'none', color: 'var(--soft-wheat)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            {decisionError && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                <AlertTriangle size={16} /> {decisionError}
              </div>
            )}

            <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', marginBottom: '1rem' }}>
              Student: <strong>{activeDecisionModalPass.student_name}</strong> ({activeDecisionModalPass.outpass_number})
            </p>

            <form onSubmit={handleConfirmDecision}>
              {decisionAction === 'reject' && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: '700' }}>Rejection Reason *</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder="Provide justification for rejecting this outpass..."
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Warden Remarks (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Internal notes or gate instructions..."
                  value={wardenNotes}
                  onChange={e => setWardenNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveDecisionModalPass(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${decisionAction === 'approve' ? 'btn-primary' : 'btn-danger'}`}
                  disabled={submittingDecision}
                >
                  {submittingDecision ? 'Processing...' : decisionAction === 'approve' ? 'Authorize & Issue QR' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details & Logs Modal */}
      {detailsData && (
        <div className="modal-backdrop">
          <div className="modal-content flat-card" style={{ maxWidth: '640px', width: '92%', border: '1px solid var(--golden-wheat)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Audit Trail</span>
                <h2 style={{ fontSize: '1.35rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginTop: '0.2rem' }}>
                  Outpass Verification &amp; Gate Logs
                </h2>
              </div>
              <button
                onClick={() => setDetailsData(null)}
                style={{ background: 'none', border: 'none', color: 'var(--soft-wheat)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            {/* Outpass summary */}
            <div style={{ background: 'var(--deep-gray)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div><strong>Pass Number:</strong> {detailsData.outpass?.outpass_number}</div>
              <div><strong>Student:</strong> {detailsData.outpass?.student_name} ({detailsData.outpass?.student_roll})</div>
              <div><strong>Status:</strong> {detailsData.outpass?.status}</div>
              <div><strong>Approved By:</strong> {detailsData.outpass?.approved_by_name || 'N/A'}</div>
            </div>

            {/* Parental Call Logs */}
            <h4 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--golden-wheat)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <PhoneCall size={16} /> Parental Call Verification Records
            </h4>
            {detailsData.callLogs?.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>No calls logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {detailsData.callLogs.map(cl => (
                  <div key={cl.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: 'var(--text-primary)' }}>
                      <span>Dialed: {cl.phone_dialed} ({cl.contact_person})</span>
                      <span style={{ color: cl.response_status === 'consent_granted' ? '#34d399' : '#fbbf24' }}>
                        {cl.response_status}
                      </span>
                    </div>
                    <div style={{ color: 'var(--soft-wheat)', marginTop: '0.2rem' }}>{cl.notes || 'No notes.'}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Logged by {cl.warden_name} at {new Date(cl.call_time).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Security Gate Check Logs */}
            <h4 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--golden-wheat)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Compass size={16} /> Security Gate Electronic Logs
            </h4>
            {detailsData.gateLogs?.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>No gate scans recorded yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {detailsData.gateLogs.map(gl => (
                  <div key={gl.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
                      <span style={{ color: gl.action === 'CHECK_OUT' ? 'var(--golden-wheat)' : '#34d399' }}>
                        {gl.action}
                      </span>
                      <span style={{ color: gl.is_late ? '#f87171' : 'var(--soft-wheat)' }}>
                        {gl.is_late ? '⚠️ LATE RECORDED' : 'On Time'}
                      </span>
                    </div>
                    <div style={{ color: 'var(--soft-wheat)', marginTop: '0.2rem' }}>{gl.remarks}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Scanned by Guard {gl.guard_name || 'System Gate'} at {new Date(gl.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setDetailsData(null)}>
              Close Audit Trail
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
