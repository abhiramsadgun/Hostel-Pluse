import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import {
  Sparkles,
  Calendar,
  Clock,
  Plus,
  CheckCircle,
  Home,
  Droplet,
  ShieldAlert,
  Wrench,
  RefreshCw,
  X,
  Filter,
} from 'lucide-react';

const SERVICE_LABELS = {
  house_cleaning: { label: 'Room Housekeeping', icon: <Home size={16} color="#34d399" /> },
  laundry: { label: 'Linen & Laundry', icon: <Droplet size={16} color="#60a5fa" /> },
  pest_control: { label: 'Pest Control', icon: <ShieldAlert size={16} color="#f59e0b" /> },
  deep_sanitization: { label: 'Deep Sanitization', icon: <Sparkles size={16} color="#a39274" /> },
};

export function RoomServicesManager({ user }) {
  const [schedules, setSchedules] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  // Filter
  const [selectedBlockId, setSelectedBlockId] = useState(user?.blockId || 'all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Schedule Modal
  const [showModal, setShowModal] = useState(false);
  const [serviceType, setServiceType] = useState('house_cleaning');
  const [modalBlockId, setModalBlockId] = useState(user?.blockId || '');
  const [selectedRoomIds, setSelectedRoomIds] = useState([]);
  const [scheduledDate, setScheduledDate] = useState(() => new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('10:00 AM - 12:00 PM');
  const [recurrence, setRecurrence] = useState('one_time');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Status Modal
  const [statusModalItem, setStatusModalItem] = useState(null);
  const [newStatus, setNewStatus] = useState('Completed');
  const [completionNotes, setCompletionNotes] = useState('');

  async function loadData() {
    setLoading(true);
    setMsg(null);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (selectedBlockId !== 'all') q.append('blockId', selectedBlockId);
      if (statusFilter !== 'all') q.append('status', statusFilter);

      const res = await api.get(`/services?${q.toString()}`);
      if (res.success) setSchedules(res.data.schedules || []);

      const bRes = await api.get('/admin/blocks');
      if (bRes.success) {
        setBlocks(bRes.data || []);
        if (!modalBlockId && bRes.data.length > 0) {
          setModalBlockId(bRes.data[0].id);
        }
      }

      const rRes = await api.get('/admin/rooms');
      if (rRes.success) setRooms(rRes.data || []);

      const stRes = await api.get('/admin/staff');
      if (stRes.success) setStaffList(stRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load services data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedBlockId, statusFilter]);

  // Handle Multi-Room Toggle
  function toggleRoomSelect(roomId) {
    setSelectedRoomIds(prev =>
      prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId]
    );
  }

  // Select all rooms in block
  function selectAllBlockRooms() {
    const blockRooms = rooms.filter(r => r.block_id === parseInt(modalBlockId, 10)).map(r => r.id);
    setSelectedRoomIds(blockRooms);
  }

  // Submit Schedule
  async function handleScheduleSubmit(e) {
    e.preventDefault();
    if (selectedRoomIds.length === 0) {
      alert('Please select at least one room.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/services', {
        serviceType,
        blockId: modalBlockId,
        roomIds: selectedRoomIds,
        scheduledDate,
        scheduledTime,
        recurrence,
        assignedStaffId: assignedStaffId || null,
        notes: serviceNotes,
      });

      if (res.success) {
        setMsg(`Scheduled service for ${selectedRoomIds.length} room(s) successfully.`);
        setShowModal(false);
        setSelectedRoomIds([]);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Scheduling failed.');
    } finally {
      setSubmitting(false);
    }
  }

  // Update Status
  async function handleStatusSubmit(e) {
    e.preventDefault();
    if (!statusModalItem) return;
    try {
      const res = await api.put(`/services/${statusModalItem.id}/status`, {
        status: newStatus,
        completionNotes,
      });
      if (res.success) {
        setMsg(`Service updated to ${newStatus}.`);
        setStatusModalItem(null);
        setCompletionNotes('');
        loadData();
      }
    } catch (err) {
      alert(err.message);
    }
  }

  const modalRooms = rooms.filter(r => r.block_id === parseInt(modalBlockId, 10));

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Top Banner */}
      <div
        className="flat-card"
        style={{
          padding: '1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderLeft: '4px solid var(--golden-wheat)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Campus Operations</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>ROOM SERVICES DISPATCH</span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-display)' }}>
            Housekeeping &amp; Routine Services Manager
          </h2>
          <p style={{ color: 'var(--soft-wheat)', fontSize: '0.85rem' }}>
            Schedule periodic room cleaning, linen laundering, pest control, and sanitization for student residences.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading} title="Refresh">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Schedule Room Service
          </button>
        </div>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Filter Strip */}
      <div className="glass-panel" style={{ padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Filter size={16} color="var(--golden-wheat)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Block:</span>
          <select className="form-select" style={{ width: 'auto' }} value={selectedBlockId} onChange={e => setSelectedBlockId(e.target.value)}>
            <option value="all">All Blocks</option>
            {blocks.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status:</span>
          <select className="form-select" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Confirmed">Confirmed by Student</option>
            <option value="Away">Resident Away</option>
            <option value="Rescheduled">Reschedule Requested</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Schedule Table */}
      {schedules.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No room services scheduled in this filter.
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Service Type</th>
                <th style={{ padding: '0.85rem 1rem' }}>Location</th>
                <th style={{ padding: '0.85rem 1rem' }}>Scheduled Slot</th>
                <th style={{ padding: '0.85rem 1rem' }}>Assigned Staff</th>
                <th style={{ padding: '0.85rem 1rem' }}>Student Response</th>
                <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                <th style={{ padding: '0.85rem 1rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(item => {
                const info = SERVICE_LABELS[item.service_type] || { label: item.service_type, icon: <Sparkles size={16} /> };
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '700' }}>
                        {info.icon}
                        <span>{info.label}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {item.recurrence.replace('_', ' ')}
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <b style={{ color: 'var(--golden-wheat)' }}>Room {item.room_number}</b>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.block_name}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div>{new Date(item.scheduled_date).toLocaleDateString()}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)' }}>{item.scheduled_time}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {item.assigned_staff_name ? (
                        <div>
                          <div>{item.assigned_staff_name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.assigned_staff_phone}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className={`badge ${item.student_acknowledgement === 'Confirmed' ? 'badge-approved' : item.student_acknowledgement === 'Away' ? 'badge-rejected' : 'badge-pending'}`}>
                        {item.student_acknowledgement}
                      </span>
                      {item.student_notes && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          "{item.student_notes}"
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className="badge badge-role">{item.status}</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => {
                          setStatusModalItem(item);
                          setNewStatus(item.status === 'Scheduled' ? 'In Progress' : 'Completed');
                          setCompletionNotes('');
                        }}
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* SCHEDULE MODAL */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Schedule Routine Room Service</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleScheduleSubmit}>
              {/* Service Type */}
              <div className="form-group">
                <label className="form-label">Service Category *</label>
                <select className="form-select" value={serviceType} onChange={e => setServiceType(e.target.value)}>
                  <option value="house_cleaning">Room Housekeeping &amp; Floor Sweeping</option>
                  <option value="laundry">Linen &amp; Bedding Laundry Collection</option>
                  <option value="pest_control">Pest Control &amp; Insecticide Spraying</option>
                  <option value="deep_sanitization">Deep Disinfection &amp; Sanitization</option>
                </select>
              </div>

              {/* Block & Recurrence */}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Hostel Block *</label>
                  <select
                    className="form-select"
                    value={modalBlockId}
                    onChange={e => {
                      setModalBlockId(e.target.value);
                      setSelectedRoomIds([]);
                    }}
                  >
                    {blocks.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.gender})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Recurrence *</label>
                  <select className="form-select" value={recurrence} onChange={e => setRecurrence(e.target.value)}>
                    <option value="one_time">One-Time Schedule</option>
                    <option value="weekly">Weekly Routine</option>
                    <option value="bi_weekly">Bi-Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              {/* Date & Time Window */}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Scheduled Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Time Window *</label>
                  <select className="form-select" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}>
                    <option value="08:30 AM - 10:30 AM">08:30 AM - 10:30 AM</option>
                    <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM</option>
                    <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM</option>
                    <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM</option>
                  </select>
                </div>
              </div>

              {/* Room Multi-Selector */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Select Target Rooms ({selectedRoomIds.length} selected) *</label>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px' }} onClick={selectAllBlockRooms}>
                    Select All in Block
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', maxHeight: '140px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}>
                  {modalRooms.map(r => {
                    const isSelected = selectedRoomIds.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRoomSelect(r.id)}
                        style={{
                          padding: '0.4rem',
                          borderRadius: '4px',
                          border: isSelected ? '1px solid var(--golden-wheat)' : '1px solid var(--border-subtle)',
                          background: isSelected ? 'rgba(163, 146, 116, 0.25)' : 'rgba(255,255,255,0.02)',
                          color: isSelected ? 'var(--golden-wheat)' : 'var(--text-secondary)',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        Room {r.room_number}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Staff Assignment */}
              <div className="form-group">
                <label className="form-label">Assign Technician / Housekeeping Staff</label>
                <select className="form-select" value={assignedStaffId} onChange={e => setAssignedStaffId(e.target.value)}>
                  <option value="">Unassigned (Open Dispatch)</option>
                  {staffList.filter(s => s.is_active).map(st => (
                    <option key={st.id} value={st.id}>{st.full_name} ({st.designation || st.department})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Scheduling...' : 'Dispatch Schedules'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPDATE STATUS MODAL */}
      {statusModalItem && (
        <div className="modal-backdrop" onClick={() => setStatusModalItem(null)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem' }}>
              Update Service Status (Room {statusModalItem.room_number})
            </h3>

            <form onSubmit={handleStatusSubmit}>
              <div className="form-group">
                <label className="form-label">Status *</label>
                <select className="form-select" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                  <option value="In Progress">In Progress (Work started)</option>
                  <option value="Completed">Completed (Work finished)</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Scheduled">Scheduled</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Completion Remarks / Observations</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="e.g. Room floors mopped, pest spray applied under cot"
                  value={completionNotes}
                  onChange={e => setCompletionNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setStatusModalItem(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Status</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
