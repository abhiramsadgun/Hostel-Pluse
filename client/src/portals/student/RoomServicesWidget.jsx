import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import {
  Sparkles,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Home,
  Trash2,
  RefreshCw,
  User,
  Phone,
  Droplet,
  ShieldAlert,
} from 'lucide-react';

const SERVICE_LABELS = {
  house_cleaning: { label: 'Room Housekeeping', icon: <Home size={18} color="#34d399" /> },
  laundry: { label: 'Linen & Laundry Collection', icon: <Droplet size={18} color="#60a5fa" /> },
  pest_control: { label: 'Pest Control & Fumigation', icon: <ShieldAlert size={18} color="#f59e0b" /> },
  deep_sanitization: { label: 'Deep Sanitization', icon: <Sparkles size={18} color="#a39274" /> },
};

export function RoomServicesWidget({ user }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  // Reschedule Modal
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('02:00 PM - 04:00 PM');
  const [studentNote, setStudentNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const studentRoomId = user?.student?.roomId || user?.student?.room_id || user?.roomId;

  async function loadServices() {
    setLoading(true);
    setMsg(null);
    setError(null);
    try {
      const res = await api.get('/services');
      if (res.success) {
        setSchedules(res.data.schedules || []);
      }
    } catch (err) {
      setError('Failed to load room services: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadServices();
  }, []);

  async function handleAcknowledge(id, acknowledgement, extra = {}) {
    try {
      const res = await api.put(`/services/${id}/acknowledge`, {
        acknowledgement,
        ...extra,
      });
      if (res.success) {
        setMsg(`Service marked as ${acknowledgement}.`);
        loadServices();
        setRescheduleItem(null);
      }
    } catch (err) {
      alert(err.message || 'Action failed.');
    }
  }

  const upcoming = schedules.filter(s => ['Scheduled', 'Confirmed', 'Rescheduled', 'Away', 'In Progress'].includes(s.status));
  const past = schedules.filter(s => ['Completed', 'Cancelled'].includes(s.status));

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Banner */}
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
            <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Residential Facility Services</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>CAMPUS SOLVE OPERATIONS</span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-display)' }}>
            Room Services Schedule
          </h2>
          <p style={{ color: 'var(--soft-wheat)', fontSize: '0.85rem' }}>
            Room <b style={{ color: 'var(--golden-wheat)' }}>{user?.student?.roomNumber || '101'}</b> &bull; Periodic housekeeping, pest control, and linen services dispatched by hostel administration.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadServices} disabled={loading} title="Refresh">
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Upcoming Services */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={18} color="var(--golden-wheat)" /> Upcoming Scheduled Services ({upcoming.length})
        </h3>

        {upcoming.length === 0 ? (
          <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No upcoming room services scheduled for your room at this moment.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {upcoming.map(item => {
              const info = SERVICE_LABELS[item.service_type] || { label: item.service_type, icon: <Sparkles size={18} /> };
              const isAcknowledged = item.student_acknowledgement === 'Confirmed';
              const isAway = item.student_acknowledgement === 'Away';
              const isRescheduled = item.student_acknowledgement === 'Rescheduled';

              return (
                <div
                  key={item.id}
                  className="flat-card"
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderLeft: isAcknowledged ? '4px solid var(--accent-emerald)' : isAway ? '4px solid var(--accent-rose)' : '4px solid var(--golden-wheat)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: '260px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        {info.icon}
                        <h4 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{info.label}</h4>
                        <span className="badge badge-role" style={{ textTransform: 'capitalize' }}>
                          {item.recurrence.replace('_', ' ')}
                        </span>
                        <span className={`badge ${isAcknowledged ? 'badge-approved' : 'badge-pending'}`}>
                          {item.student_acknowledgement}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--soft-wheat)', margin: '0.4rem 0' }}>
                        <div>Scheduled Date: <b style={{ color: 'var(--golden-wheat)' }}>{new Date(item.scheduled_date).toLocaleDateString()}</b></div>
                        <div>Time Window: <b style={{ color: 'var(--text-primary)' }}>{item.scheduled_time}</b></div>
                        {item.assigned_staff_name && (
                          <div>Assigned Staff: <b style={{ color: 'var(--text-primary)' }}>{item.assigned_staff_name}</b></div>
                        )}
                      </div>

                      {item.student_notes && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          <b>Your note:</b> {item.student_notes}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons for Student */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className={`btn btn-sm ${isAcknowledged ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleAcknowledge(item.id, 'Confirmed')}
                      >
                        <CheckCircle size={14} /> Confirm Presence
                      </button>

                      <button
                        className={`btn btn-sm ${isAway ? 'btn-danger' : 'btn-secondary'}`}
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleAcknowledge(item.id, 'Away', { notes: 'Room residents away/attending lectures' })}
                      >
                        <XCircle size={14} /> Mark Away
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => {
                          setRescheduleItem(item);
                          setPreferredDate(item.scheduled_date?.split('T')[0] || '');
                          setStudentNote('');
                        }}
                      >
                        Request Reschedule
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Service History */}
      {past.length > 0 && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '0.75rem', color: 'var(--golden-wheat)' }}>
            Completed Service History
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.5rem' }}>Service Type</th>
                  <th style={{ padding: '0.5rem' }}>Date &amp; Time</th>
                  <th style={{ padding: '0.5rem' }}>Technician</th>
                  <th style={{ padding: '0.5rem' }}>Completion Notes</th>
                  <th style={{ padding: '0.5rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {past.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '0.6rem 0.5rem', fontWeight: '600', textTransform: 'capitalize' }}>
                      {p.service_type.replace('_', ' ')}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)' }}>
                      {new Date(p.scheduled_date).toLocaleDateString()} ({p.scheduled_time})
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem' }}>{p.assigned_staff_name || 'Staff'}</td>
                    <td style={{ padding: '0.6rem 0.5rem', color: 'var(--soft-wheat)' }}>
                      {p.completion_notes || 'Completed as scheduled.'}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem' }}>
                      <span className="badge badge-approved">{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {rescheduleItem && (
        <div className="modal-backdrop" onClick={() => setRescheduleItem(null)}>
          <div className="modal-card" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem' }}>
              Request Service Reschedule
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Propose an alternative slot when you or your roommates are available in Room {user?.student?.roomNumber}.
            </p>

            <form
              onSubmit={e => {
                e.preventDefault();
                handleAcknowledge(rescheduleItem.id, 'Rescheduled', {
                  preferredDate,
                  preferredTime,
                  notes: studentNote,
                });
              }}
            >
              <div className="form-group">
                <label className="form-label">Preferred Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={preferredDate}
                  onChange={e => setPreferredDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Preferred Time Window *</label>
                <select
                  className="form-select"
                  value={preferredTime}
                  onChange={e => setPreferredTime(e.target.value)}
                >
                  <option value="09:00 AM - 11:00 AM">09:00 AM - 11:00 AM</option>
                  <option value="11:00 AM - 01:00 PM">11:00 AM - 01:00 PM</option>
                  <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM</option>
                  <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Reason / Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Lab exam scheduled in morning, available after 2 PM"
                  value={studentNote}
                  onChange={e => setStudentNote(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRescheduleItem(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Reschedule Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
