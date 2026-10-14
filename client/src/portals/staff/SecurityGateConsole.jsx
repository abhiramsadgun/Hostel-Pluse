import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import { useAuth } from '../../shared/AuthContext';
import {
  Compass,
  QrCode,
  CheckCircle,
  AlertTriangle,
  Clock,
  Shield,
  Search,
  ArrowRight,
  ArrowLeft,
  User,
  History,
  AlertOctagon,
} from 'lucide-react';

export function SecurityGateConsole() {
  const { user } = useAuth();
  const [passInput, setPassInput] = useState('');
  const [activeOutpasses, setActiveOutpasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [remarks, setRemarks] = useState('');

  // Fetch active passes (Approved, Out, Overdue)
  async function fetchActivePasses() {
    setLoading(true);
    try {
      const res = await api.get('/outpass?gateMode=active');
      if (res.success) {
        setActiveOutpasses(res.data.outpasses || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchActivePasses();
    const interval = setInterval(fetchActivePasses, 20000);
    return () => clearInterval(interval);
  }, []);

  async function handleGateAction(passNumberToUse, actionType) {
    const num = passNumberToUse || passInput.trim();
    if (!num) {
      setActionError('Please scan or enter an outpass number.');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const res = await api.post('/outpass/gate-check', {
        outpassNumber: num,
        action: actionType, // 'CHECK_OUT' or 'CHECK_IN'
        remarks: remarks || undefined,
      });

      if (res.success) {
        setActionMessage(res.data.message);
        setPassInput('');
        setRemarks('');
        fetchActivePasses();
      }
    } catch (err) {
      setActionError(err.message || 'Gate clearance operation failed.');
    } finally {
      setSubmitting(false);
    }
  }

  const studentsOut = activeOutpasses.filter(o => o.status === 'Out' || o.status === 'Overdue');
  const readyToLeave = activeOutpasses.filter(o => o.status === 'Approved');

  return (
    <div style={{ maxWidth: '1150px', margin: '1.5rem auto', padding: '0 1rem' }}>
      {/* Top Banner */}
      <div className="photo-hero-banner" style={{ minHeight: '180px', marginBottom: '1.75rem' }}>
        <img
          src="https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1200&q=80"
          alt="Campus Main Security Gate"
          className="photo-hero-image"
        />
        <div className="photo-hero-overlay">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>
                  Electronic Sentry Clearance
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                  SECURITY GATE DISPATCH CONSOLE
                </span>
              </div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginBottom: '0.25rem' }}>
                Campus Gate Clearance
              </h1>
              <p style={{ color: 'var(--soft-wheat)', fontSize: '0.88rem' }}>
                Scan resident digital QR passes or enter outpass serials for electronic check-out and return logging.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div
                style={{
                  background: 'var(--deep-gray)',
                  border: '1px solid var(--border-medium)',
                  borderTop: '3px solid var(--golden-wheat)',
                  padding: '0.65rem 1.1rem',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Off Campus Now</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--golden-wheat)' }}>{studentsOut.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action feedback */}
      {actionMessage && (
        <div className="alert alert-success" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={18} /> {actionMessage}
          </div>
          <button onClick={() => setActionMessage(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} /> {actionError}
          </div>
          <button onClick={() => setActionError(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}

      {/* Fast Scan / Entry Terminal */}
      <div
        className="flat-card"
        style={{
          padding: '1.5rem',
          marginBottom: '2rem',
          border: '1px solid var(--golden-wheat)',
          background: 'var(--deep-gray)',
        }}
      >
        <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--golden-wheat)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <QrCode size={20} /> Electronic Gate Entry &amp; Exit Scanner
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: '700' }}>Outpass Serial / QR Raw String *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. OUT-2026-000001 or scan QR directly"
              value={passInput}
              onChange={e => setPassInput(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', padding: '0.65rem 0.85rem' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Gate Officer Remarks (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Left with parent / Helmet checked"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-primary"
              disabled={submitting || !passInput.trim()}
              onClick={() => handleGateAction(null, 'CHECK_OUT')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.75rem' }}
            >
              <ArrowRight size={16} /> Mark Exit (Check-Out)
            </button>
            <button
              className="btn btn-secondary"
              disabled={submitting || !passInput.trim()}
              onClick={() => handleGateAction(null, 'CHECK_IN')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.75rem', borderColor: '#10b981', color: '#34d399' }}
            >
              <ArrowLeft size={16} /> Mark Entry (Check-In)
            </button>
          </div>
        </div>
      </div>

      {/* Split lists: Approved (Ready to Leave) and Off-Campus (Students currently Out) */}
      <div className="grid-2">
        {/* Box 1: Ready to Depart (Approved Passes) */}
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={18} color="#34d399" /> Approved for Exit ({readyToLeave.length})
          </h3>

          {readyToLeave.length === 0 ? (
            <div className="flat-card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--soft-wheat)', fontSize: '0.85rem' }}>
              No pending approved departures at this hour.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {readyToLeave.map(p => (
                <div key={p.id} className="flat-card" style={{ padding: '1rem', borderLeft: '4px solid #10b981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--golden-wheat)', fontSize: '0.88rem' }}>
                        {p.outpass_number}
                      </div>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{p.student_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--soft-wheat)' }}>
                        {p.block_name} &bull; Room {p.room_number || 'N/A'}
                      </div>
                      <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
                        Dest: <strong>{p.destination}</strong>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleGateAction(p.outpass_number, 'CHECK_OUT')}
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.65rem' }}
                    >
                      Clear Exit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Box 2: Currently Off-Campus */}
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} color="var(--golden-wheat)" /> Currently Off Campus ({studentsOut.length})
          </h3>

          {studentsOut.length === 0 ? (
            <div className="flat-card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--soft-wheat)', fontSize: '0.85rem' }}>
              All students accounted for inside hostel premises.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {studentsOut.map(p => {
                const isOverdue = p.status === 'Overdue' || new Date() > new Date(p.expected_return_time);
                return (
                  <div
                    key={p.id}
                    className="flat-card"
                    style={{
                      padding: '1rem',
                      borderLeft: isOverdue ? '4px solid #ef4444' : '4px solid var(--golden-wheat)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--golden-wheat)', fontSize: '0.88rem' }}>
                            {p.outpass_number}
                          </span>
                          {isOverdue && (
                            <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: '800', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                              OVERDUE
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{p.student_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--soft-wheat)' }}>
                          Parent: {p.parent_name} ({p.parent_phone})
                        </div>
                        <div style={{ fontSize: '0.78rem', marginTop: '0.25rem', color: isOverdue ? '#f87171' : 'inherit' }}>
                          Expected Return: {new Date(p.expected_return_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleGateAction(p.outpass_number, 'CHECK_IN')}
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.65rem', borderColor: '#10b981', color: '#34d399' }}
                      >
                        Clear Entry
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
