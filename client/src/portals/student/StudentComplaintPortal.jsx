import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../shared/api';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Sparkles,
  Camera,
  X,
  ThumbsUp,
  MessageSquare,
  Star,
  Eye,
  EyeOff,
  Building,
  Home,
  RefreshCw,
  Plus,
  Send,
  Zap,
  Droplet,
  Wifi,
  Shield,
  Utensils,
  Wrench,
  Trash2,
} from 'lucide-react';

const CATEGORY_ICONS = {
  plumbing: <Droplet size={18} color="#38bdf8" />,
  electrical: <Zap size={18} color="#facc15" />,
  furniture: <Home size={18} color="#fb923c" />,
  cleanliness: <Trash2 size={18} color="#4ade80" />,
  internet: <Wifi size={18} color="#818cf8" />,
  mess: <Utensils size={18} color="#f472b6" />,
  security: <Shield size={18} color="#f87171" />,
  other: <Wrench size={18} color="#94a3b8" />,
};

export function StudentComplaintPortal({ user }) {
  const student = user?.student;

  // Active view tab: 'my' | 'room' | 'block'
  const [activeSubTab, setActiveSubTab] = useState('my');

  // Lists
  const [myComplaints, setMyComplaints] = useState([]);
  const [roomComplaints, setRoomComplaints] = useState([]);
  const [blockComplaints, setBlockComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Submit Modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryKey, setCategoryKey] = useState('auto');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Live AI Suggestion State
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const debounceTimerRef = useRef(null);

  // Selected Ticket for detail / feedback modal
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Load all lists
  async function loadData() {
    setLoading(true);
    try {
      // 1. My complaints
      const myRes = await api.get('/complaints/my');
      if (myRes.success) setMyComplaints(myRes.data.complaints || []);

      // 2. Room complaints
      if (student?.roomId || student?.room_id) {
        const rId = student.roomId || student.room_id;
        const roomRes = await api.get(`/complaints/room/${rId}`);
        if (roomRes.success) setRoomComplaints(roomRes.data.complaints || []);
      }

      // 3. Block complaints (open issues for upvoting)
      const blockRes = await api.get('/complaints?status=Submitted,Assigned,In%20Progress&limit=30');
      if (blockRes.success) {
        // Exclude own complaints from upvote list
        const filtered = (blockRes.data.complaints || []).filter(c => c.student_id !== student?.id);
        setBlockComplaints(filtered);
      }
    } catch (err) {
      console.warn('Student complaints load warn:', err.message);
    } finally {
      setLoading(false);
    }
  }

  // Initial load and real-time polling every 20 seconds
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, []);

  // Live AI Category & Turnaround Debounce Trigger
  useEffect(() => {
    if (!title && !description) {
      setAiSuggestion(null);
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      if (title.length >= 3 || description.length >= 5) {
        setAiLoading(true);
        try {
          const res = await api.post('/complaints/classify-ai', { title, description });
          if (res.success) {
            setAiSuggestion(res.data);
          }
        } catch (e) {
          // non-critical
        } finally {
          setAiLoading(false);
        }
      }
    }, 450);

    return () => clearTimeout(debounceTimerRef.current);
  }, [title, description]);

  // Handle Photo File Select (up to 4)
  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (photos.length + files.length > 4) {
      alert('You can upload a maximum of 4 photos.');
      return;
    }

    const validFiles = [];
    const validPreviews = [];

    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        alert(`File ${f.name} exceeds 5MB limit.`);
        continue;
      }
      validFiles.push(f);
      validPreviews.push(URL.createObjectURL(f));
    }

    setPhotos(prev => [...prev, ...validFiles]);
    setPhotoPreviews(prev => [...prev, ...validPreviews]);
  }

  function handleRemovePhoto(index) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  }

  // Submit Complaint
  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('categoryKey', categoryKey === 'auto' ? (aiSuggestion?.categoryKey || 'other') : categoryKey);
      formData.append('isAnonymous', isAnonymous ? 'true' : 'false');

      for (const p of photos) {
        formData.append('photos', p);
      }

      const token = localStorage.getItem('hostelpulse_token');
      const res = await fetch('/api/v1/complaints', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to lodge complaint.');
      }

      setSuccessMsg(`Ticket ${json.data.complaint.complaint_id} lodged successfully! Expected turnaround: ~${json.data.prediction.predictedHours}h.`);
      setShowSubmitModal(false);
      setTitle('');
      setDescription('');
      setCategoryKey('auto');
      setIsAnonymous(false);
      setPhotos([]);
      setPhotoPreviews([]);
      setAiSuggestion(null);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Toggle Upvote ("I'm also affected")
  async function handleToggleVote(complaintId) {
    try {
      const res = await api.post(`/complaints/${complaintId}/vote`);
      if (res.success) {
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Upvote failed.');
    }
  }

  // View Ticket Details
  async function handleOpenDetails(id) {
    try {
      const res = await api.get(`/complaints/${id}`);
      if (res.success) {
        setSelectedComplaint(res.data);
        setDetailModalOpen(true);
      }
    } catch (err) {
      alert(err.message || 'Failed to load details.');
    }
  }

  // Submit Student Feedback
  async function handleFeedbackSubmit(e) {
    e.preventDefault();
    if (!selectedComplaint) return;
    setSubmittingFeedback(true);
    try {
      const res = await api.post(`/complaints/${selectedComplaint.complaint.id}/feedback`, {
        rating: feedbackRating,
        comments: feedbackComment,
      });
      if (res.success) {
        setSuccessMsg('Thank you for rating our hostel maintenance work!');
        setDetailModalOpen(false);
        loadData();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingFeedback(false);
    }
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Hero Header & Quick Actions */}
      <div
        className="flat-card"
        style={{
          padding: '1.75rem',
          marginBottom: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          background: 'linear-gradient(135deg, rgba(37, 37, 35, 0.95) 0%, rgba(25, 25, 24, 0.98) 100%)',
          borderLeft: '4px solid var(--golden-wheat)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Resident Operations</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>CAMPUS SOLVE CORE</span>
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginBottom: '0.25rem' }}>
            Hostel Complaint &amp; Maintenance Tracker
          </h2>
          <p style={{ color: 'var(--soft-wheat)', fontSize: '0.85rem' }}>
            Room <b style={{ color: 'var(--golden-wheat)' }}>{student?.roomNumber || '101'}</b> &bull; {student?.blockName || 'Aryabhatta Boys Block A'} &bull; Real-time AI triage &amp; turnaround prediction.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={loadData} disabled={loading} title="Refresh lists">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowSubmitModal(true);
              setError(null);
            }}
            style={{ padding: '0.75rem 1.4rem', fontWeight: '700' }}
          >
            <Plus size={18} /> Lodge New Complaint
          </button>
        </div>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-medium)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
        <button
          className={`btn btn-sm ${activeSubTab === 'my' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('my')}
        >
          My Tickets ({myComplaints.length})
        </button>
        <button
          className={`btn btn-sm ${activeSubTab === 'room' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('room')}
        >
          Active in Room {student?.roomNumber || '101'} ({roomComplaints.length})
        </button>
        <button
          className={`btn btn-sm ${activeSubTab === 'block' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('block')}
        >
          Block Community Issues ({blockComplaints.length})
        </button>
      </div>

      {/* VIEW 1: MY COMPLAINTS */}
      {activeSubTab === 'my' && (
        <div>
          {myComplaints.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
              <CheckCircle size={44} color="var(--accent-emerald)" style={{ margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.25rem' }}>No Active Personal Complaints</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Your room and amenities are in good standing. Have a maintenance issue? Lodge a ticket in seconds.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowSubmitModal(true)}>
                <Plus size={16} /> Lodge Complaint
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {myComplaints.map(c => {
                const statusColor = c.status === 'Resolved' || c.status === 'Closed' ? 'var(--accent-emerald)' : c.status === 'In Progress' ? 'var(--accent-blue)' : 'var(--golden-wheat)';
                return (
                  <div
                    key={c.id}
                    className="flat-card"
                    style={{
                      padding: '1.25rem 1.5rem',
                      borderLeft: `4px solid ${statusColor}`,
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                    }}
                    onClick={() => handleOpenDetails(c.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ flex: 1, minWidth: '260px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--golden-wheat)', fontSize: '0.85rem' }}>
                            {c.complaint_id}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                            {CATEGORY_ICONS[c.category_key] || <Wrench size={14} />}
                            <span style={{ textTransform: 'capitalize' }}>{c.category_key}</span>
                          </span>
                          {c.is_anonymous && (
                            <span className="badge badge-role" style={{ fontSize: '0.65rem' }}>
                              <EyeOff size={12} /> Confidential
                            </span>
                          )}
                          {c.is_overdue && (
                            <span className="badge badge-rejected" style={{ fontSize: '0.65rem' }}>
                              Overdue
                            </span>
                          )}
                        </div>

                        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.35rem' }}>{c.title}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', lineHeight: '1.4', marginBottom: '0.5rem' }}>
                          {c.description}
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>Lodged: {new Date(c.created_at).toLocaleDateString()}</span>
                          <span>Expected Turnaround: ~{c.predicted_hours}h</span>
                          {c.feedback_rating && (
                            <span style={{ color: 'var(--accent-amber)', fontWeight: '700' }}>
                              ★ Rated {c.feedback_rating}/5
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Status Badge & Rating CTA */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            background: c.status === 'Resolved' || c.status === 'Closed' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(163, 146, 116, 0.2)',
                            color: statusColor,
                            border: `1px solid ${statusColor}`,
                          }}
                        >
                          {c.status}
                        </span>

                        {c.status === 'Resolved' && !c.feedback_rating && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ background: 'var(--accent-amber)', color: '#000', fontSize: '0.75rem' }}
                            onClick={e => {
                              e.stopPropagation();
                              handleOpenDetails(c.id);
                            }}
                          >
                            <Star size={14} /> Leave Rating
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: ACTIVE IN ROOM */}
      {activeSubTab === 'room' && (
        <div>
          <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Complaints lodged for <b>Room {student?.roomNumber || '101'}</b>. Check here to avoid duplicate submissions by roommates.
          </div>
          {roomComplaints.length === 0 ? (
            <div className="glass-panel" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
              <CheckCircle size={36} color="var(--accent-emerald)" style={{ margin: '0 auto 0.5rem' }} />
              <div style={{ fontWeight: '700', fontSize: '1rem' }}>No Active Room Complaints</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>All amenities in your room are fully functional.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {roomComplaints.map(rc => (
                <div key={rc.id} className="flat-card" style={{ padding: '1rem 1.25rem', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--golden-wheat)', fontSize: '0.8rem' }}>
                          {rc.complaint_id}
                        </span>
                        <span className="badge badge-role" style={{ fontSize: '0.65rem' }}>{rc.category_key}</span>
                      </div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: '700' }}>{rc.title}</h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Lodged by roommate: {rc.student_name} &bull; {new Date(rc.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="badge badge-approved">{rc.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: BLOCK COMMUNITY ISSUES & UPVOTING */}
      {activeSubTab === 'block' && (
        <div>
          <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Open issues in <b>{student?.blockName || 'your hostel block'}</b>. Click <b>"I'm Also Affected"</b> to increase the priority score for faster resolution!
          </div>

          {blockComplaints.length === 0 ? (
            <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No other open public issues in your block.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {blockComplaints.map(bc => (
                <div key={bc.id} className="flat-card" style={{ padding: '1.25rem', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: '260px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--golden-wheat)', fontWeight: '700', fontSize: '0.85rem' }}>
                          {bc.complaint_id}
                        </span>
                        <span className="badge badge-role" style={{ fontSize: '0.65rem' }}>{bc.category_key}</span>
                        {bc.room_number && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)' }}>Room {bc.room_number}</span>
                        )}
                        {bc.is_overdue && <span className="badge badge-rejected" style={{ fontSize: '0.65rem' }}>Overdue</span>}
                      </div>

                      <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.35rem' }}>{bc.title}</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', lineHeight: '1.4' }}>{bc.description}</p>
                    </div>

                    {/* Upvote Button */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{
                          background: 'rgba(163, 146, 116, 0.15)',
                          border: '1px solid var(--golden-wheat)',
                          color: 'var(--golden-wheat)',
                          fontWeight: '700',
                          gap: '0.4rem',
                        }}
                        onClick={() => handleToggleVote(bc.id)}
                      >
                        <ThumbsUp size={16} /> I'm Also Affected ({bc.affected_count || 1})
                      </button>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Score: {bc.priority_score}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBMISSION MODAL */}
      {showSubmitModal && (
        <div className="modal-backdrop" onClick={() => setShowSubmitModal(false)}>
          <div className="modal-card" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '800', fontFamily: 'var(--font-display)' }}>
                  Lodge Maintenance Complaint
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Auto-routed to {student?.blockName || 'Assigned Block'} Warden &amp; Technicians
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSubmitModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Title */}
              <div className="form-group">
                <label className="form-label">Issue Headline / Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Bathroom tap leaking water continuously"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Detailed Description *</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Describe the issue, exact location in room, severity, and when it began..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                />
              </div>

              {/* LIVE AI TRIAGE PREVIEW BANNER */}
              {aiSuggestion && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(163, 146, 116, 0.18) 0%, rgba(25, 25, 24, 0.9) 100%)',
                    border: '1px solid var(--golden-wheat)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                      <Sparkles size={14} /> AI AUTO-TRIAGE ENGINE
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', marginTop: '0.15rem' }}>
                      Suggested Category: <span style={{ color: 'var(--golden-wheat)', textTransform: 'capitalize' }}>{aiSuggestion.categoryName}</span> ({Math.round(aiSuggestion.confidence * 100)}% match)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)' }}>
                      Estimated Turnaround: <b style={{ color: 'var(--accent-emerald)' }}>~{aiSuggestion.predictedHours}h</b> ({aiSuggestion.predictionSource})
                    </div>
                  </div>

                  {categoryKey !== aiSuggestion.categoryKey && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => setCategoryKey(aiSuggestion.categoryKey)}
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    >
                      Use Suggested ({aiSuggestion.categoryKey})
                    </button>
                  )}
                </div>
              )}

              {/* Category Selector */}
              <div className="form-group">
                <label className="form-label">Category *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                  {[
                    { key: 'auto', label: 'AI Auto-Detect', icon: <Sparkles size={14} /> },
                    { key: 'plumbing', label: 'Plumbing', icon: <Droplet size={14} /> },
                    { key: 'electrical', label: 'Electrical', icon: <Zap size={14} /> },
                    { key: 'furniture', label: 'Furniture', icon: <Home size={14} /> },
                    { key: 'cleanliness', label: 'Hygiene', icon: <Trash2 size={14} /> },
                    { key: 'internet', label: 'Wi-Fi / LAN', icon: <Wifi size={14} /> },
                    { key: 'mess', label: 'Food / Mess', icon: <Utensils size={14} /> },
                    { key: 'security', label: 'Security', icon: <Shield size={14} /> },
                    { key: 'other', label: 'Other', icon: <Wrench size={14} /> },
                  ].map(cat => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setCategoryKey(cat.key)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        border: categoryKey === cat.key ? '2px solid var(--golden-wheat)' : '1px solid var(--border-medium)',
                        background: categoryKey === cat.key ? 'rgba(163, 146, 116, 0.2)' : 'rgba(255,255,255,0.02)',
                        color: categoryKey === cat.key ? 'var(--golden-wheat)' : 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                      }}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location (Auto-Filled) */}
              <div className="grid-2" style={{ marginBottom: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Assigned Block</label>
                  <input type="text" className="form-input" value={student?.blockName || 'Block A'} disabled />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Allocated Room</label>
                  <input type="text" className="form-input" value={`Room ${student?.roomNumber || '101'}`} disabled />
                </div>
              </div>

              {/* Photo Uploads (Up to 4) */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Issue Photo Evidence (Up to 4 images, optional)</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max 5MB per file (JPEG, PNG, WebP)</span>
                </label>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {photoPreviews.map((p, idx) => (
                    <div key={idx} style={{ position: 'relative', width: '70px', height: '70px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--golden-wheat)' }}>
                      <img src={p} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}

                  {photos.length < 4 && (
                    <label
                      style={{
                        width: '70px',
                        height: '70px',
                        borderRadius: 'var(--radius-sm)',
                        border: '2px dashed var(--border-medium)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.65rem',
                        textAlign: 'center',
                      }}
                    >
                      <Camera size={18} color="var(--golden-wheat)" />
                      <span>Add</span>
                      <input type="file" accept="image/*" multiple onChange={handlePhotoSelect} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
              </div>

              {/* Confidential / Anonymous Flag */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 1rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <input
                  type="checkbox"
                  id="anonCheck"
                  checked={isAnonymous}
                  onChange={e => setIsAnonymous(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--golden-wheat)' }}
                />
                <label htmlFor="anonCheck" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
                  <b style={{ color: 'var(--golden-wheat)' }}>Mark as Confidential / Sensitive:</b> Hide my identity from roommates and block peers; visible exclusively to the Warden and Chief Admin.
                </label>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSubmitModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <Send size={16} /> {submitting ? 'Lodging Ticket...' : 'Lodge Complaint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL & TIMELINE TRACKER MODAL */}
      {detailModalOpen && selectedComplaint && (
        <div className="modal-backdrop" onClick={() => setDetailModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--golden-wheat)', fontSize: '0.85rem' }}>
                  {selectedComplaint.complaint.complaint_id}
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginTop: '0.2rem' }}>
                  {selectedComplaint.complaint.title}
                </h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setDetailModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Status & Priority Badge Strip */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <span className="badge badge-approved">{selectedComplaint.complaint.status}</span>
              <span className="badge badge-role" style={{ textTransform: 'capitalize' }}>{selectedComplaint.complaint.category_key}</span>
              <span style={{ fontSize: '0.75rem', background: 'rgba(163, 146, 116, 0.15)', color: 'var(--golden-wheat)', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                Priority: {selectedComplaint.complaint.priority_score}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Target SLA: {selectedComplaint.complaint.sla_hours}h
              </span>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--soft-wheat)', lineHeight: '1.5', marginBottom: '1.25rem' }}>
              {selectedComplaint.complaint.description}
            </p>

            {/* Photos Strip */}
            {selectedComplaint.images && selectedComplaint.images.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  Photo Attachments ({selectedComplaint.images.length})
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  {selectedComplaint.images.map(img => (
                    <div key={img.id} style={{ position: 'relative', width: '100px', height: '100px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-medium)', flexShrink: 0 }}>
                      <img src={`/uploads/complaints/${img.image_url}`} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <span style={{ position: 'absolute', bottom: 2, left: 2, background: 'rgba(0,0,0,0.7)', fontSize: '0.6rem', padding: '1px 4px', borderRadius: '2px', color: '#fff', textTransform: 'uppercase' }}>
                        {img.image_type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* REAL-TIME TIMELINE TRACKER */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--golden-wheat)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Live Resolution Timeline &amp; Status Logs
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', paddingLeft: '1rem' }}>
                {selectedComplaint.timeline && selectedComplaint.timeline.map((log, idx) => (
                  <div key={log.id} style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-1rem', top: '4px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--golden-wheat)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{log.to_status}</b>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.notes}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Actor: {log.actor_name || log.actor_role}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* FEEDBACK SECTION IF RESOLVED */}
            {selectedComplaint.complaint.status === 'Resolved' && (
              <div style={{ background: 'rgba(163, 146, 116, 0.1)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--golden-wheat)' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '0.35rem', color: 'var(--golden-wheat)' }}>
                  Rate the Maintenance Resolution
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--soft-wheat)', marginBottom: '0.75rem' }}>
                  Please confirm that the repair was completed satisfactorily.
                </p>

                <form onSubmit={handleFeedbackSubmit}>
                  {/* Star Rating */}
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.2rem',
                          color: star <= feedbackRating ? 'var(--accent-amber)' : 'var(--text-muted)',
                        }}
                      >
                        <Star size={24} fill={star <= feedbackRating ? 'var(--accent-amber)' : 'none'} />
                      </button>
                    ))}
                    <span style={{ marginLeft: '0.5rem', fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)', alignSelf: 'center' }}>
                      {feedbackRating} / 5 Stars
                    </span>
                  </div>

                  <div className="form-group">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Optional comments (e.g. Technician arrived on time, problem solved cleanly)"
                      value={feedbackComment}
                      onChange={e => setFeedbackComment(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary btn-sm" disabled={submittingFeedback}>
                    {submittingFeedback ? 'Submitting...' : 'Submit Rating & Close Ticket'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
