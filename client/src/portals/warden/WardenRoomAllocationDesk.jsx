import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import { useAuth } from '../../shared/AuthContext';
import {
  Building,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  Shield,
  Layers,
  Award,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';

export function WardenRoomAllocationDesk() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Allocation modal
  const [activeReqToAllocate, setActiveReqToAllocate] = useState(null);
  const [wardenNotes, setWardenNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function fetchRequests() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/rooms/requests');
      if (res.success) {
        setRequests(res.data.requests || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch room requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  async function handleConfirmAllocate(e) {
    e.preventDefault();
    if (!activeReqToAllocate) return;
    setSubmitting(true);

    try {
      const res = await api.post(`/rooms/requests/${activeReqToAllocate.id}/allocate`, {
        wardenNotes,
      });

      if (res.success) {
        setSuccessMsg(res.data.message);
        setActiveReqToAllocate(null);
        setWardenNotes('');
        fetchRequests();
      }
    } catch (err) {
      alert(err.message || 'Allocation failed.');
    } finally {
      setSubmitting(false);
    }
  }

  const pendingRequests = requests.filter(r => ['Pending', 'Waitlisted'].includes(r.status));
  const completedRequests = requests.filter(r => ['Allocated', 'Rejected'].includes(r.status));

  return (
    <div style={{ maxWidth: '1200px', margin: '1.5rem auto', padding: '0 1rem' }}>
      {/* Top Banner */}
      <div className="photo-hero-banner" style={{ minHeight: '190px', marginBottom: '1.75rem' }}>
        <img
          src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80"
          alt="Warden Room Allocation Headquarters"
          className="photo-hero-image"
        />
        <div className="photo-hero-overlay">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>
                  Warden Housing Authority
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                  TRANSACTIONAL ROOM ALLOCATION &amp; WAITLIST
                </span>
              </div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginBottom: '0.25rem' }}>
                Room Allocation &amp; Waitlist Desk
              </h1>
              <p style={{ color: 'var(--soft-wheat)', fontSize: '0.88rem' }}>
                Prioritized queue based on conflict resolution rules: first-come, then seniority score (academic year &amp; tenure).
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
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>In Queue</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--golden-wheat)' }}>{pendingRequests.length}</div>
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

      {/* Rules Notice */}
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
          <Award size={16} color="var(--golden-wheat)" />
          <span><strong>Conflict Resolution:</strong> Seniority Rank (Year × 100 + Stay Days) followed by First-Come timestamp</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Shield size={16} color="#10b981" />
          <span><strong>Transactional Integrity:</strong> Safe atomic rollback guarantees no orphan resident states</span>
        </div>
      </div>

      {/* PENDING & WAITLIST QUEUE */}
      <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Users size={18} color="var(--golden-wheat)" /> Prioritized Requests &amp; Waitlist ({pendingRequests.length})
      </h3>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--soft-wheat)' }}>
          <div>Loading allocation queue...</div>
        </div>
      ) : pendingRequests.length === 0 ? (
        <div className="flat-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', marginBottom: '2rem' }}>
          <CheckCircle size={36} color="var(--golden-wheat)" style={{ marginBottom: '0.75rem', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.35rem' }}>Queue is Clear</h3>
          <p style={{ color: 'var(--soft-wheat)', fontSize: '0.85rem' }}>No pending room requests requiring allocation.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
          {pendingRequests.map((req, idx) => {
            const isWaitlisted = req.status === 'Waitlisted';
            const vacancies = req.available_vacancies || 0;
            const groupSize = req.member_details?.length || 1;
            const canAllocate = vacancies >= groupSize;

            return (
              <div
                key={req.id}
                className="flat-card"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderLeft: isWaitlisted ? '4px solid #fbbf24' : '4px solid var(--golden-wheat)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
                  <div style={{ flex: '1 1 380px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                      <span className="flat-wheat-badge" style={{ fontSize: '0.72rem', fontWeight: '800' }}>
                        PRIORITY #{idx + 1}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--golden-wheat)' }}>
                        Score: {req.seniority_score} pts
                      </span>
                      <span className="flat-badge" style={{ fontSize: '0.7rem' }}>
                        {req.status}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Applied {new Date(req.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                      Group: {req.group_name || 'Individual Request'} &bull; Target: Room {req.room_number} ({req.block_name})
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--soft-wheat)', marginBottom: '0.5rem' }}>
                      Class: <strong>{req.target_class}</strong> &bull; Year <strong>{req.target_year}</strong> &bull; Applicant: {req.applicant_name} ({req.applicant_roll})
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                      <strong>Stated Purpose:</strong> {req.reason}
                    </div>

                    {/* Member Details */}
                    {req.member_details?.length > 0 && (
                      <div style={{ background: 'var(--deep-gray)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>GROUP MEMBERS ({req.member_details.length}):</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                          {req.member_details.map(m => (
                            <span key={m.studentId} style={{ color: 'var(--soft-wheat)' }}>
                              &bull; <strong>{m.name}</strong> ({m.roll}) [Current: {m.currentRoom || 'None'}]
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Room Vacancy & Allocation Action */}
                  <div
                    style={{
                      background: 'var(--deep-gray)',
                      border: '1px solid var(--border-medium)',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      minWidth: '260px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>TARGET ROOM CAPACITY</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      Room {req.room_number}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: canAllocate ? '#34d399' : '#f87171', fontWeight: '700', marginBottom: '0.75rem' }}>
                      {vacancies} Free Slot(s) for Group of {groupSize}
                    </div>

                    <button
                      className="btn btn-primary"
                      disabled={!canAllocate}
                      onClick={() => {
                        setActiveReqToAllocate(req);
                        setWardenNotes('');
                      }}
                      style={{
                        width: '100%',
                        opacity: !canAllocate ? 0.5 : 1,
                        cursor: !canAllocate ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                      }}
                      title={!canAllocate ? 'Waitlisted: Target room does not have enough free beds' : 'Allocate now'}
                    >
                      <Check size={16} /> Allocate Room Now
                    </button>

                    {!canAllocate && (
                      <div style={{ fontSize: '0.68rem', color: '#fbbf24', marginTop: '0.45rem' }}>
                        Waitlisted until existing occupants check out
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation & Transaction Modal */}
      {activeReqToAllocate && (
        <div className="modal-backdrop">
          <div className="modal-content flat-card" style={{ maxWidth: '520px', width: '92%', border: '2px solid var(--golden-wheat)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Transactional Execution</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginTop: '0.2rem' }}>
                  Authorize Room Allocation
                </h2>
              </div>
              <button
                onClick={() => setActiveReqToAllocate(null)}
                style={{ background: 'none', border: 'none', color: 'var(--soft-wheat)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', marginBottom: '1rem', lineHeight: '1.4' }}>
              Confirm transactional move for group <strong>{activeReqToAllocate.group_name}</strong> into <strong>Room {activeReqToAllocate.room_number}</strong>. This executes an atomic database commit updating room occupant counts, resident profiles, and official move logs.
            </p>

            <form onSubmit={handleConfirmAllocate}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Warden Authorization Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Allocation confirmed. Keys issued at warden office."
                  value={wardenNotes}
                  onChange={e => setWardenNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveReqToAllocate(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Executing Transaction...' : 'Confirm & Commit Move'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
