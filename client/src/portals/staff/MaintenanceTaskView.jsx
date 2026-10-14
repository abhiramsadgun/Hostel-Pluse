import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import {
  Wrench,
  CheckCircle,
  Clock,
  Camera,
  Play,
  FileText,
  AlertTriangle,
  Send,
  RefreshCw,
  X,
  Building,
  User,
} from 'lucide-react';

export function MaintenanceTaskView({ user }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('active'); // 'active' | 'resolved' | 'all'
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  // Resolve Modal
  const [resolveTask, setResolveTask] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [afterPhoto, setAfterPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submittingResolve, setSubmittingResolve] = useState(false);

  async function loadTasks() {
    setLoading(true);
    setMsg(null);
    setError(null);
    try {
      const res = await api.get('/complaints?assignedOnly=true&limit=50');
      if (res.success) {
        setTasks(res.data.complaints || []);
      }
    } catch (err) {
      setError('Failed to load assigned tasks: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  // Quick Action: Start Work -> In Progress
  async function handleStartWork(taskId) {
    try {
      const res = await api.post(`/complaints/${taskId}/status`, {
        status: 'In Progress',
        notes: `Technician ${user?.fullName} commenced repair work on site.`,
      });
      if (res.success) {
        setMsg(`Task moved to 'In Progress'.`);
        loadTasks();
      }
    } catch (err) {
      alert(err.message || 'Failed to update status.');
    }
  }

  // Handle Photo Select
  function handlePhotoSelect(e) {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit.');
        return;
      }
      setAfterPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }

  // Submit Task Resolution
  async function handleResolveSubmit(e) {
    e.preventDefault();
    if (!completionNotes.trim()) {
      alert('Please provide work completion notes.');
      return;
    }

    setSubmittingResolve(true);
    try {
      const formData = new FormData();
      formData.append('notes', completionNotes);
      if (afterPhoto) {
        formData.append('afterPhoto', afterPhoto);
      }

      const token = localStorage.getItem('hostelpulse_token');
      const res = await fetch(`/api/v1/complaints/${resolveTask.id}/resolve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Resolution submission failed.');
      }

      setMsg(`Task ${resolveTask.complaint_id} resolved! Turnaround: ${json.data.resolutionHours}h recorded.`);
      setResolveTask(null);
      setCompletionNotes('');
      setAfterPhoto(null);
      setPhotoPreview(null);
      loadTasks();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingResolve(false);
    }
  }

  const filteredTasks = tasks.filter(t => {
    if (filter === 'active') return ['Assigned', 'In Progress', 'Submitted'].includes(t.status);
    if (filter === 'resolved') return ['Resolved', 'Closed'].includes(t.status);
    return true;
  });

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
            <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Field Operations</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>TECHNICIAN DISPATCH</span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-display)' }}>
            Maintenance Task Console
          </h2>
          <p style={{ color: 'var(--soft-wheat)', fontSize: '0.85rem' }}>
            Logged in as: <b style={{ color: 'var(--text-primary)' }}>{user?.fullName}</b> &bull; Department: Facility Maintenance
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadTasks} disabled={loading} title="Refresh">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}>
            <button
              className={`btn btn-sm ${filter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', fontSize: '0.75rem' }}
              onClick={() => setFilter('active')}
            >
              Active ({tasks.filter(t => ['Assigned', 'In Progress'].includes(t.status)).length})
            </button>
            <button
              className={`btn btn-sm ${filter === 'resolved' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', fontSize: '0.75rem' }}
              onClick={() => setFilter('resolved')}
            >
              Completed ({tasks.filter(t => ['Resolved', 'Closed'].includes(t.status)).length})
            </button>
            <button
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', fontSize: '0.75rem' }}
              onClick={() => setFilter('all')}
            >
              All ({tasks.length})
            </button>
          </div>
        </div>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Task Cards */}
      {filteredTasks.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <CheckCircle size={44} color="var(--accent-emerald)" style={{ margin: '0 auto 0.75rem' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>No Tasks in this Filter</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>All assigned work orders have been processed.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredTasks.map(task => {
            const isDone = task.status === 'Resolved' || task.status === 'Closed';
            return (
              <div
                key={task.id}
                className="flat-card"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderLeft: isDone ? '4px solid var(--accent-emerald)' : task.status === 'In Progress' ? '4px solid var(--accent-blue)' : '4px solid var(--golden-wheat)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--golden-wheat)', fontSize: '0.85rem' }}>
                        {task.complaint_id}
                      </span>
                      <span className="badge badge-role" style={{ textTransform: 'capitalize' }}>
                        {task.category_key}
                      </span>
                      <span className="badge badge-approved">{task.status}</span>
                      {task.is_overdue && <span className="badge badge-rejected">Overdue SLA</span>}
                      {task.is_recurring && <span className="badge badge-pending">Hotspot</span>}
                    </div>

                    <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.35rem' }}>{task.title}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', lineHeight: '1.4', marginBottom: '0.75rem' }}>
                      {task.description}
                    </p>

                    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div>Location: <b style={{ color: 'var(--text-primary)' }}>{task.room_number ? `Room ${task.room_number}` : 'Common Area'} &bull; {task.block_name}</b></div>
                      <div>Resident: <b style={{ color: 'var(--text-primary)' }}>{task.student_name}</b></div>
                      <div>Priority Score: <b style={{ color: 'var(--golden-wheat)', fontFamily: 'var(--font-mono)' }}>{task.priority_score}</b></div>
                    </div>

                    {task.assigned_note && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', background: 'rgba(163, 146, 116, 0.1)', padding: '4px 8px', borderRadius: '4px', color: 'var(--golden-wheat)' }}>
                        <b>Warden Instruction:</b> {task.assigned_note}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '160px' }}>
                    {!isDone && task.status !== 'In Progress' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)' }}
                        onClick={() => handleStartWork(task.id)}
                      >
                        <Play size={14} /> Start Work
                      </button>
                    )}

                    {!isDone && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ background: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)', color: '#000', fontWeight: '700' }}
                        onClick={() => {
                          setResolveTask(task);
                          setCompletionNotes('');
                          setAfterPhoto(null);
                          setPhotoPreview(null);
                        }}
                      >
                        <CheckCircle size={14} /> Mark Resolved
                      </button>
                    )}

                    {isDone && (
                      <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: '700' }}>
                        ✓ Work Complete
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RESOLUTION MODAL WITH AFTER-PHOTO UPLOAD */}
      {resolveTask && (
        <div className="modal-backdrop" onClick={() => setResolveTask(null)}>
          <div className="modal-card" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--golden-wheat)', fontSize: '0.85rem' }}>
                  {resolveTask.complaint_id}
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Complete &amp; Resolve Work Order</h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setResolveTask(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit}>
              <div className="form-group">
                <label className="form-label">Completion Notes / Actions Taken *</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Detail parts replaced, cleaning done, or adjustments made (e.g. Cleaned drain pipe, replaced silicone gasket)..."
                  value={completionNotes}
                  onChange={e => setCompletionNotes(e.target.value)}
                  required
                />
              </div>

              {/* After-Photo Upload */}
              <div className="form-group">
                <label className="form-label">Evidence After-Photo (Optional)</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {photoPreview && (
                    <div style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--golden-wheat)' }}>
                      <img src={photoPreview} alt="After preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <label
                    className="btn btn-secondary btn-sm"
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Camera size={16} /> {photoPreview ? 'Change Photo' : 'Upload After-Photo'}
                    <input type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setResolveTask(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)', color: '#000', fontWeight: '700' }}
                  disabled={submittingResolve}
                >
                  <CheckCircle size={16} /> {submittingResolve ? 'Saving Resolution...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
