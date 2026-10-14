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
  Search,
  UserPlus,
  RefreshCw,
  DoorOpen,
  Calendar,
  Layers,
  ArrowLeftRight,
} from 'lucide-react';

export function StudentRoomAllocation() {
  const { user } = useAuth();
  const student = user?.student;

  const [eligibility, setEligibility] = useState(null);
  const [myStatus, setMyStatus] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modals
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteRoll, setInviteRoll] = useState('');
  const [submittingGroup, setSubmittingGroup] = useState(false);

  // Room Request Modal
  const [selectedRoomForReq, setSelectedRoomForReq] = useState(null);
  const [requestReason, setRequestReason] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);

  // Peer Swap Modal
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapRoll, setSwapRoll] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [submittingSwap, setSubmittingSwap] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [eRes, stRes, rRes] = await Promise.all([
        api.get('/rooms/eligibility').catch(() => ({ success: false })),
        api.get('/rooms/my-status').catch(() => ({ success: false })),
        api.get('/rooms/explore').catch(() => ({ success: false })),
      ]);

      if (eRes.success) setEligibility(eRes.data);
      if (stRes.success) setMyStatus(stRes.data);
      if (rRes.success) setRooms(rRes.data.rooms || []);
    } catch (err) {
      setError(err.message || 'Failed to load room allocation details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateGroup(e) {
    e.preventDefault();
    if (!groupName.trim()) return;
    setSubmittingGroup(true);
    setError(null);

    try {
      const res = await api.post('/rooms/groups', { groupName });
      if (res.success) {
        setSuccessMsg(`Group "${groupName}" created! You can now invite peers from your class.`);
        setShowCreateGroupModal(false);
        setGroupName('');
        loadData();
      }
    } catch (err) {
      setError(err.message || 'Failed to create group.');
    } finally {
      setSubmittingGroup(false);
    }
  }

  async function handleInviteMember(e) {
    e.preventDefault();
    if (!inviteRoll.trim() || !myStatus?.activeGroup?.id) return;
    setSubmittingGroup(true);

    try {
      const res = await api.post(`/rooms/groups/${myStatus.activeGroup.id}/invite`, {
        studentRollNumber: inviteRoll.trim(),
      });
      if (res.success) {
        setSuccessMsg(res.data.message);
        setInviteRoll('');
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Invitation failed.');
    } finally {
      setSubmittingGroup(false);
    }
  }

  async function handleRespondInvite(groupId, response) {
    try {
      const res = await api.put(`/rooms/groups/${groupId}/respond`, { response });
      if (res.success) {
        setSuccessMsg(res.data.message);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Response failed.');
    }
  }

  async function handleSubmitRoomRequest(e) {
    e.preventDefault();
    if (!selectedRoomForReq || !myStatus?.activeGroup?.id) return;

    setSubmittingReq(true);
    try {
      const res = await api.post('/rooms/requests', {
        groupId: myStatus.activeGroup.id,
        preferredRoomId: selectedRoomForReq.id,
        reason: requestReason,
      });

      if (res.success) {
        setSuccessMsg(res.data.message);
        setSelectedRoomForReq(null);
        setRequestReason('');
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Request failed.');
    } finally {
      setSubmittingReq(false);
    }
  }

  async function handleSubmitSwap(e) {
    e.preventDefault();
    if (!swapRoll.trim() || !swapReason.trim()) return;

    setSubmittingSwap(true);
    try {
      const res = await api.post('/rooms/swap', {
        swapWithRollNumber: swapRoll.trim(),
        reason: swapReason,
      });
      if (res.success) {
        setSuccessMsg('Peer room swap requested. Warden and peer student notified.');
        setShowSwapModal(false);
        setSwapRoll('');
        setSwapReason('');
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Swap request failed.');
    } finally {
      setSubmittingSwap(false);
    }
  }

  const isEligible = eligibility?.isEligible;
  const activeGroup = myStatus?.activeGroup;
  const members = myStatus?.members || [];
  const pendingInvites = myStatus?.pendingInvites || [];
  const moveHistory = myStatus?.history || [];

  return (
    <div style={{ maxWidth: '1200px', margin: '1.5rem auto', padding: '0 1rem' }}>
      {/* Top Banner */}
      <div className="photo-hero-banner" style={{ minHeight: '190px', marginBottom: '1.75rem' }}>
        <img
          src="https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80"
          alt="Hostel Residence Architecture"
          className="photo-hero-image"
        />
        <div className="photo-hero-overlay">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>
                  Smart Housing Matrix
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                  ROOM ALLOCATION &amp; PEER GROUPS
                </span>
              </div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginBottom: '0.25rem' }}>
                Hostel Room Reallocation
              </h1>
              <p style={{ color: 'var(--soft-wheat)', fontSize: '0.88rem' }}>
                Form peer groups with classmates, explore vacant rooms, join waitlists, or request 1-on-1 room swaps.
              </p>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowSwapModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <ArrowLeftRight size={16} /> Request Peer Swap
              </button>

              {!activeGroup && (
                <button
                  className="btn btn-primary"
                  disabled={!isEligible}
                  onClick={() => setShowCreateGroupModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: !isEligible ? 0.6 : 1 }}
                >
                  <Users size={16} /> Create Allocation Group
                </button>
              )}
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

      {/* TENURE ELIGIBILITY CARD */}
      <div
        className="flat-card"
        style={{
          padding: '1.25rem 1.5rem',
          marginBottom: '1.75rem',
          background: 'var(--deep-gray)',
          borderLeft: isEligible ? '4px solid #10b981' : '4px solid #ef4444',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              Residency Tenure Eligibility Status
            </span>
            {isEligible ? (
              <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid #10b981', padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: '800' }}>
                ✓ ELIGIBLE FOR ALLOCATION
              </span>
            ) : (
              <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid #ef4444', padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: '800' }}>
                TENURE REQUIREMENT UNMET
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--soft-wheat)' }}>
            Campus Policy requires a minimum of <strong>{eligibility?.threshold || 7} months</strong> continuous stay from your joining date ({eligibility?.joinedOn || 'Recorded'}). You have completed <strong>{eligibility?.monthsStayed || 0} months</strong>.
            {!isEligible && ` (${eligibility?.remainingMonths || 0} months remaining before eligibility window opens).`}
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>YOUR CLASS &amp; YEAR</div>
          <div style={{ fontWeight: '800', color: 'var(--golden-wheat)', fontSize: '1.1rem' }}>
            {student?.class || 'B.Tech'} - Year {student?.year || 2}
          </div>
        </div>
      </div>

      {/* INVITATIONS BANNER IF ANY */}
      {pendingInvites.length > 0 && (
        <div
          className="flat-card"
          style={{
            padding: '1.25rem',
            marginBottom: '1.75rem',
            border: '2px solid var(--golden-wheat)',
            background: 'rgba(163, 146, 116, 0.1)',
          }}
        >
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--golden-wheat)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} /> Pending Room Group Invitations
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingInvites.map(inv => (
              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--deep-gray)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontWeight: '700' }}>{inv.group_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--soft-wheat)' }}>
                    Invited by <strong>{inv.leader_name}</strong> for {inv.target_class} (Year {inv.target_year})
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleRespondInvite(inv.id, 'Accepted')}
                  >
                    Accept Invite
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleRespondInvite(inv.id, 'Declined')}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ACTIVE GROUP CARD */}
      {activeGroup && (
        <div
          className="flat-card"
          style={{
            padding: '1.5rem',
            marginBottom: '2rem',
            border: '1px solid var(--golden-wheat)',
            background: 'var(--deep-gray)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Active Group</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                  STATUS: {activeGroup.status}
                </span>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: 'var(--font-display)' }}>
                {activeGroup.group_name}
              </h2>
              <div style={{ fontSize: '0.82rem', color: 'var(--soft-wheat)' }}>
                Target: {activeGroup.target_class} &bull; Year {activeGroup.target_year} &bull; Gender: {activeGroup.target_gender}
              </div>
            </div>

            {/* Invite Peer Form */}
            {activeGroup.status === 'Forming' && (
              <form onSubmit={handleInviteMember} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Peer Roll No (e.g. 24881A05GE)"
                  value={inviteRoll}
                  onChange={e => setInviteRoll(e.target.value)}
                  style={{ width: '220px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submittingGroup || !inviteRoll.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <UserPlus size={14} /> Invite Peer
                </button>
              </form>
            )}
          </div>

          {/* Members List */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
            {members.map(m => (
              <div key={m.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{m.full_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)' }}>Roll: {m.roll_number}</div>
                <div style={{ fontSize: '0.72rem', color: m.invite_status === 'Accepted' || m.invite_status === 'Leader' ? '#34d399' : '#fbbf24', marginTop: '0.2rem', fontWeight: '700' }}>
                  {m.invite_status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXPLORE ROOMS MATRIX */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <DoorOpen size={20} color="var(--golden-wheat)" /> Explore Hostel Rooms &amp; Vacancies
        </h3>
        <p style={{ color: 'var(--soft-wheat)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Select a room that fits your group size. If all beds are occupied, you will automatically be placed on the waitlist with seniority priority.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '1rem' }}>
          {rooms.map(r => {
            const isFull = r.vacancies <= 0;
            return (
              <div
                key={r.id}
                className="flat-card"
                style={{
                  padding: '1.25rem',
                  borderTop: isFull ? '3px solid #ef4444' : '3px solid #10b981',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--golden-wheat)' }}>
                      Room {r.room_number}
                    </span>
                    <span className="flat-wheat-badge" style={{ fontSize: '0.68rem' }}>
                      Floor {r.floor} &bull; {r.block_name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                    <span>Capacity: <strong>{r.capacity} Beds</strong></span>
                    <span style={{ color: isFull ? '#f87171' : '#34d399', fontWeight: '700' }}>
                      {isFull ? 'Occupied (Waitlist Only)' : `${r.vacancies} Bed(s) Free`}
                    </span>
                  </div>

                  {/* Occupants list */}
                  {r.current_resident_details?.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)', background: 'var(--deep-gray)', padding: '0.5rem', borderRadius: '4px', marginBottom: '0.85rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginBottom: '0.2rem' }}>CURRENT RESIDENTS:</div>
                      {r.current_resident_details.map(res => (
                        <div key={res.id}>&bull; {res.name} ({res.class})</div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  className={`btn btn-sm ${isFull ? 'btn-secondary' : 'btn-primary'}`}
                  disabled={!activeGroup}
                  onClick={() => setSelectedRoomForReq(r)}
                  style={{ width: '100%', marginTop: '0.5rem' }}
                >
                  {isFull ? 'Join Waitlist for Room' : 'Request Allocation'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* MOVE HISTORY TABLE */}
      {moveHistory.length > 0 && (
        <div className="flat-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} color="var(--golden-wheat)" /> Your Room Move History
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-medium)', color: 'var(--golden-wheat)' }}>
                  <th style={{ padding: '0.6rem' }}>Date</th>
                  <th style={{ padding: '0.6rem' }}>Move Type</th>
                  <th style={{ padding: '0.6rem' }}>From Room</th>
                  <th style={{ padding: '0.6rem' }}>To Room</th>
                  <th style={{ padding: '0.6rem' }}>Authorized By</th>
                  <th style={{ padding: '0.6rem' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {moveHistory.map(h => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.6rem' }}>{new Date(h.moved_at).toLocaleDateString()}</td>
                    <td style={{ padding: '0.6rem', fontWeight: '700' }}>{h.move_type}</td>
                    <td style={{ padding: '0.6rem' }}>{h.from_room_num || 'New Admission'}</td>
                    <td style={{ padding: '0.6rem', fontWeight: '700', color: 'var(--golden-wheat)' }}>{h.to_room_num}</td>
                    <td style={{ padding: '0.6rem' }}>{h.authorizer_name || 'System'}</td>
                    <td style={{ padding: '0.6rem', color: 'var(--soft-wheat)' }}>{h.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request Room Modal */}
      {selectedRoomForReq && (
        <div className="modal-backdrop">
          <div className="modal-content flat-card" style={{ maxWidth: '480px', width: '92%', border: '1px solid var(--golden-wheat)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Preferred Choice</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginTop: '0.2rem' }}>
                  Request Room {selectedRoomForReq.room_number}
                </h2>
              </div>
              <button
                onClick={() => setSelectedRoomForReq(null)}
                style={{ background: 'none', border: 'none', color: 'var(--soft-wheat)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', marginBottom: '1rem' }}>
              Group: <strong>{activeGroup?.group_name}</strong> &bull; Block: <strong>{selectedRoomForReq.block_name}</strong>
            </p>

            {selectedRoomForReq.vacancies <= 0 && (
              <div className="alert alert-warning" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
                Room is currently occupied. Submitting will register your group on the official Waitlist Queue.
              </div>
            )}

            <form onSubmit={handleSubmitRoomRequest}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Reason for Choice *</label>
                <textarea
                  className="form-input"
                  rows="3"
                  placeholder="e.g. Near study hall, ground floor required for mobility, classmates together..."
                  value={requestReason}
                  onChange={e => setRequestReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedRoomForReq(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingReq}>
                  {submittingReq ? 'Submitting...' : 'Confirm Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Peer Swap Modal */}
      {showSwapModal && (
        <div className="modal-backdrop">
          <div className="modal-content flat-card" style={{ maxWidth: '480px', width: '92%', border: '1px solid var(--golden-wheat)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Peer-to-Peer</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginTop: '0.2rem' }}>
                  Propose Peer Room Swap
                </h2>
              </div>
              <button
                onClick={() => setShowSwapModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--soft-wheat)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitSwap}>
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Peer Resident Roll Number *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 24881A05GF"
                  value={swapRoll}
                  onChange={e => setSwapRoll(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Mutual Agreement Reason *</label>
                <textarea
                  className="form-input"
                  rows="3"
                  placeholder="Explain why both residents wish to swap rooms..."
                  value={swapReason}
                  onChange={e => setSwapReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSwapModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingSwap}>
                  {submittingSwap ? 'Submitting...' : 'Submit Swap Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="modal-backdrop">
          <div className="modal-content flat-card" style={{ maxWidth: '480px', width: '92%', border: '1px solid var(--golden-wheat)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Peer Housing</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginTop: '0.2rem' }}>
                  Create Allocation Group
                </h2>
              </div>
              <button
                onClick={() => setShowCreateGroupModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--soft-wheat)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--soft-wheat)', marginBottom: '1rem' }}>
              Groups are restricted to classmates in <strong>{student?.class || 'Same Class'} (Year {student?.year || 2})</strong> to preserve academic study environments.
            </p>

            <form onSubmit={handleCreateGroup}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Group Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Apex Quad / Quantum Seniors"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateGroupModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingGroup}>
                  {submittingGroup ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
