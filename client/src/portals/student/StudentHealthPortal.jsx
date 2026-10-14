import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import { useAuth } from '../../shared/AuthContext';
import {
  HeartPulse,
  AlertTriangle,
  CheckCircle,
  Clock,
  Phone,
  ShieldAlert,
  Ambulance,
  Pill,
  Send,
  User,
  Shield,
  Activity,
  FileText,
  AlertOctagon,
  ArrowRight,
} from 'lucide-react';

export function StudentHealthPortal() {
  const { user } = useAuth();
  const student = user?.student;

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form states
  const [symptoms, setSymptoms] = useState('');
  const [severity, setSeverity] = useState('mild');
  const [submitting, setSubmitting] = useState(false);
  const [sosTriggering, setSosTriggering] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);

  // Selected Ticket for Details & Prescriptions
  const [selectedTicketDetails, setSelectedTicketDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  async function fetchTickets() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/health');
      if (res.success) {
        setTickets(res.data.tickets || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch medical history.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTickets();
  }, []);

  async function handleRaiseTicket(e) {
    e.preventDefault();
    if (!symptoms.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post('/health', {
        symptoms,
        severity,
        isSos: false,
      });

      if (res.success) {
        setSuccessMsg('Health request submitted. Medical team has been notified.');
        setShowFormModal(false);
        setSymptoms('');
        setSeverity('mild');
        fetchTickets();
      }
    } catch (err) {
      setError(err.message || 'Could not submit health request.');
    } finally {
      setSubmitting(false);
    }
  }

  // BIG RED SOS TRIGGER
  async function handleEmergencySOS() {
    const confirmSOS = window.confirm(
      '🚨 TRIGGER EMERGENCY CODE RED SOS?\n\nThis will bypass the standard queue, immediately alert campus first responders, notify your block warden, and send high-priority SMS alerts to your parent/guardian.'
    );
    if (!confirmSOS) return;

    setSosTriggering(true);
    setError(null);

    try {
      const res = await api.post('/health', {
        symptoms: 'URGENT RESCUE REQUIRED: Resident pressed Code Red Emergency SOS Button.',
        severity: 'emergency',
        isSos: true,
      });

      if (res.success) {
        setSuccessMsg('🚨 EMERGENCY SOS DISPATCHED: First responders and hostel warden have been alerted to your room location immediately!');
        fetchTickets();
      }
    } catch (err) {
      setError(err.message || 'Emergency trigger failed. Please call hostel warden directly.');
    } finally {
      setSosTriggering(false);
    }
  }

  async function handleViewDetails(ticketId) {
    setLoadingDetails(true);
    try {
      const res = await api.get(`/health/${ticketId}`);
      if (res.success) {
        setSelectedTicketDetails(res.data);
      }
    } catch (err) {
      alert('Could not load ticket details.');
    } finally {
      setLoadingDetails(false);
    }
  }

  return (
    <div style={{ maxWidth: '1150px', margin: '1.5rem auto', padding: '0 1rem' }}>
      {/* Top Banner */}
      <div className="photo-hero-banner" style={{ minHeight: '190px', marginBottom: '1.75rem' }}>
        <img
          src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80"
          alt="Campus Health Center"
          className="photo-hero-image"
        />
        <div className="photo-hero-overlay">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>
                  24/7 Hostel Medical Support
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                  HEALTH ASSISTANCE &amp; EMERGENCY CARE
                </span>
              </div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginBottom: '0.25rem' }}>
                Hostel Health Clinic &amp; First Aid
              </h1>
              <p style={{ color: 'var(--soft-wheat)', fontSize: '0.88rem' }}>
                Report illness symptoms, receive room visits from certified medical attendants, and emergency transit to hospitals.
              </p>
            </div>

            {/* Emergency SOS & Action */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowFormModal(true)}
                style={{ padding: '0.75rem 1.1rem' }}
              >
                + Request Medical Care
              </button>

              {/* BIG RED SOS BUTTON */}
              <button
                onClick={handleEmergencySOS}
                disabled={sosTriggering}
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                  color: '#ffffff',
                  border: '2px solid #fca5a5',
                  padding: '0.75rem 1.4rem',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: '800',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 0 20px rgba(239, 68, 68, 0.45)',
                  animation: 'pulse 2s infinite',
                }}
              >
                <ShieldAlert size={20} />
                {sosTriggering ? 'DISPATCHING...' : '🚨 EMERGENCY SOS'}
              </button>
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

      {/* Health Profile Bar (Allergies & Emergency Contact) */}
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
          <Activity size={16} color="var(--golden-wheat)" />
          <span><strong>Known Allergies:</strong> {student?.allergies || 'None declared'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Phone size={16} color="var(--golden-wheat)" />
          <span><strong>Emergency Contact:</strong> {student?.emergencyContact || student?.parentPhone || 'Parent Registered'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Shield size={16} color="var(--golden-wheat)" />
          <span><strong>Privacy:</strong> Records visible only to you, attending medic, and block warden</span>
        </div>
      </div>

      {/* Tickets List */}
      <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <HeartPulse size={20} color="var(--golden-wheat)" /> My Medical Requests &amp; Consultations
      </h3>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--soft-wheat)' }}>
          <div className="brand-icon" style={{ margin: '0 auto 1rem', width: '48px', height: '48px' }}>
            <HeartPulse size={24} color="#191918" />
          </div>
          <div>Loading health logs...</div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="flat-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <CheckCircle size={36} color="#10b981" style={{ marginBottom: '0.75rem', opacity: 0.7 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.35rem' }}>No active medical issues</h3>
          <p style={{ color: 'var(--soft-wheat)', fontSize: '0.85rem' }}>
            You haven't requested any medical assistance. Stay healthy!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {tickets.map(t => {
            const isSos = t.is_sos;
            const isEmergency = t.severity === 'emergency';
            const isOnWay = t.status === 'On The Way';
            const isResolved = t.status === 'Resolved';

            return (
              <div
                key={t.id}
                className="flat-card"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderLeft: isSos || isEmergency
                    ? '4px solid #ef4444'
                    : isOnWay
                    ? '4px solid #3b82f6'
                    : isResolved
                    ? '4px solid #10b981'
                    : '4px solid var(--golden-wheat)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: '1 1 350px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--golden-wheat)' }}>
                        HT-{t.id.toString().padStart(5, '0')}
                      </span>
                      {isSos && (
                        <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.68rem', fontWeight: '800', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                          🚨 CODE RED SOS
                        </span>
                      )}
                      <span className="flat-wheat-badge" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                        Severity: {t.severity}
                      </span>
                      <span
                        style={{
                          background: isOnWay ? 'rgba(59, 130, 246, 0.2)' : isResolved ? 'rgba(16, 185, 129, 0.2)' : 'rgba(217, 119, 6, 0.2)',
                          color: isOnWay ? '#93c5fd' : isResolved ? '#34d399' : '#fbbf24',
                          border: `1px solid ${isOnWay ? '#3b82f6' : isResolved ? '#10b981' : '#d97706'}`,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '9999px',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                        }}
                      >
                        {t.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      Symptoms: {t.symptoms}
                    </div>

                    {t.observations && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', background: 'var(--deep-gray)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
                        <strong>Medic Observations:</strong> {t.observations}
                      </div>
                    )}

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Raised at {new Date(t.created_at).toLocaleString()} &bull; Assigned Medic: {t.assistant_name || 'Dispatching...'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                    {t.vehicle_status && (
                      <div
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid #ef4444',
                          color: '#f87171',
                          padding: '0.35rem 0.65rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <Ambulance size={14} /> Medical Van: {t.vehicle_status}
                      </div>
                    )}

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleViewDetails(t.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Pill size={14} color="var(--golden-wheat)" /> View Prescribed Medicines
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showFormModal && (
        <div className="modal-backdrop">
          <div className="modal-content flat-card" style={{ maxWidth: '500px', width: '92%', border: '1px solid var(--golden-wheat)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Medical Request</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginTop: '0.2rem' }}>
                  Request Health Assistance
                </h2>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--soft-wheat)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRaiseTicket}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Describe Symptoms *</label>
                <textarea
                  className="form-input"
                  rows="3"
                  placeholder="e.g. High fever with shivering since morning, severe stomach pain..."
                  value={symptoms}
                  onChange={e => setSymptoms(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Severity Level *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {[
                    { id: 'mild', label: 'Mild', desc: 'Cold / Headaches' },
                    { id: 'moderate', label: 'Moderate', desc: 'Fever / Nausea' },
                    { id: 'emergency', label: 'Emergency', desc: 'Trauma / Acute' },
                  ].map(lvl => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setSeverity(lvl.id)}
                      style={{
                        background: severity === lvl.id ? 'var(--golden-wheat)' : 'var(--deep-gray)',
                        color: severity === lvl.id ? '#191918' : 'var(--soft-wheat)',
                        border: severity === lvl.id ? '1px solid var(--golden-wheat)' : '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.6rem 0.4rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontWeight: '800', fontSize: '0.85rem' }}>{lvl.label}</div>
                      <div style={{ fontSize: '0.65rem' }}>{lvl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowFormModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Dispatch Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Details & Prescriptions Modal */}
      {selectedTicketDetails && (
        <div className="modal-backdrop">
          <div className="modal-content flat-card" style={{ maxWidth: '580px', width: '92%', border: '1px solid var(--golden-wheat)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Clinical Treatment Record</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginTop: '0.2rem' }}>
                  Medicines &amp; Care Details
                </h2>
              </div>
              <button
                onClick={() => setSelectedTicketDetails(null)}
                style={{ background: 'none', border: 'none', color: 'var(--soft-wheat)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'var(--deep-gray)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div><strong>Symptoms:</strong> {selectedTicketDetails.ticket?.symptoms}</div>
              <div><strong>Attending Medic:</strong> {selectedTicketDetails.ticket?.assistant_name || 'Staff On Duty'}</div>
              <div><strong>Status:</strong> {selectedTicketDetails.ticket?.status}</div>
            </div>

            <h4 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--golden-wheat)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Pill size={16} /> Administered Medications
            </h4>
            {selectedTicketDetails.medicines?.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--soft-wheat)', marginBottom: '1.25rem' }}>
                No medicines administered yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {selectedTicketDetails.medicines.map(m => (
                  <div key={m.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: 'var(--text-primary)' }}>
                      <span>{m.medicine_name} ({m.dosage})</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--golden-wheat)' }}>{new Date(m.administered_at).toLocaleTimeString()}</span>
                    </div>
                    {m.notes && <div style={{ color: 'var(--soft-wheat)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{m.notes}</div>}
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Administered by {m.administered_by_name}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setSelectedTicketDetails(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
