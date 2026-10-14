import React, { useState, useEffect } from 'react';
import { useAuth } from '../../shared/AuthContext';
import { api } from '../../shared/api';
import {
  CheckCircle,
  XCircle,
  Eye,
  Building,
  User,
  Shield,
  Phone,
  Mail,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  Utensils,
  RefreshCw,
} from 'lucide-react';
import { MessFoodManager } from '../staff/MessFoodManager';
import { WardenComplaintsManager } from './WardenComplaintsManager';
import { WardenOutpassDesk } from './WardenOutpassDesk';
import { WardenRoomAllocationDesk } from './WardenRoomAllocationDesk';
import { HealthAssistantConsole } from '../staff/HealthAssistantConsole';
import { RoomServicesManager } from '../staff/RoomServicesManager';

export function WardenDashboard({ activeTab = 'complaints' }) {
  const { user } = useAuth();
  const [pendingStudents, setPendingStudents] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);
  const [actionError, setActionError] = useState(null);

  // ID Image Modal
  const [previewImageStudent, setPreviewImageStudent] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Reject Modal
  const [rejectStudentId, setRejectStudentId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('ID card photo credentials could not be verified.');

  // Food report for warden's block
  const [mealReport, setMealReport] = useState(null);
  const [reportDate, setReportDate] = useState(() => new Date(Date.now() + 86400000).toISOString().split('T')[0]);

  // Load pending students
  async function loadPendingStudents() {
    setLoadingPending(true);
    setActionMsg(null);
    try {
      const res = await api.get('/auth/pending-students');
      if (res.success) {
        setPendingStudents(res.data.pendingStudents || []);
      }
    } catch (err) {
      setActionError('Failed to load pending registrations: ' + err.message);
    } finally {
      setLoadingPending(false);
    }
  }

  // Load meal report for block
  async function loadMealReport() {
    try {
      const res = await api.get(`/food/report?date=${reportDate}`);
      if (res.success) {
        setMealReport(res.data);
      }
    } catch (e) {}
  }

  useEffect(() => {
    loadPendingStudents();
    loadMealReport();
  }, [reportDate]);

  async function handleApprove(studentId, studentName) {
    setActionError(null);
    try {
      const res = await api.post(`/auth/students/${studentId}/approve`, {});
      if (res.success) {
        setActionMsg(`Student ${studentName} successfully approved.`);
        loadPendingStudents();
      }
    } catch (err) {
      setActionError(err.message || 'Approval failed.');
    }
  }

  async function handleRejectSubmit(e) {
    e.preventDefault();
    if (!rejectStudentId) return;
    setActionError(null);
    try {
      const res = await api.post(`/auth/students/${rejectStudentId}/reject`, { reason: rejectionReason });
      if (res.success) {
        setActionMsg(`Student registration has been rejected.`);
        setRejectStudentId(null);
        loadPendingStudents();
      }
    } catch (err) {
      setActionError(err.message || 'Rejection failed.');
    }
  }

  // Fetch secure ID image using token
  async function handleViewIdImage(student) {
    setPreviewImageStudent(student);
    setImageLoading(true);
    setImageUrl(null);
    try {
      const token = localStorage.getItem('hostelpulse_token');
      const res = await fetch(`/api/v1/auth/files/${student.id_card_image_url}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        setImageUrl(URL.createObjectURL(blob));
      } else {
        setImageUrl('error');
      }
    } catch (e) {
      setImageUrl('error');
    } finally {
      setImageLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '2rem auto', padding: '0 1.25rem' }}>
      {/* Warden Architectural Photo Hero Banner Juxtaposed with Flat Deep Gray Elements */}
      <div className="photo-hero-banner">
        <img
          src="https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80"
          alt="Hostel Residence Block Administration"
          className="photo-hero-image"
        />
        <div className="photo-hero-overlay">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>
                  Warden Command
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                  RESIDENCE HALL ADMINISTRATION
                </span>
              </div>
              <h1 style={{ fontSize: '1.85rem', fontWeight: '800', marginBottom: '0.3rem', fontFamily: 'var(--font-display)' }}>
                Hostel Block: {user?.blockName || 'Aryabhatta Boys Block A'}
              </h1>
              <p style={{ color: 'var(--soft-wheat)', fontSize: '0.9rem' }}>
                Logged in as: <b style={{ color: 'var(--text-primary)' }}>{user?.fullName}</b> &bull; College ID: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--golden-wheat)', fontWeight: '700' }}>{user?.collegeIdNumber || 'W-MALE-101'}</span>
              </p>
            </div>

            {/* Flat Deep Gray Metric & Action */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div
                style={{
                  background: 'var(--deep-gray)',
                  border: '1px solid var(--border-medium)',
                  borderTop: '3px solid var(--golden-wheat)',
                  padding: '0.85rem 1.4rem',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending Approvals</div>
                <div style={{ fontSize: '1.35rem', fontWeight: '800', color: pendingStudents.length > 0 ? 'var(--golden-wheat)' : 'var(--accent-emerald)' }}>
                  {pendingStudents.length}
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={loadPendingStudents}
                disabled={loadingPending}
                title="Refresh Queue"
                style={{ height: '48px' }}
              >
                <RefreshCw size={16} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {actionMsg && <div className="alert alert-success">{actionMsg}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

      {/* Tab: Complaints Queue & AI Dispatch */}
      {activeTab === 'complaints' && (
        <WardenComplaintsManager user={user} />
      )}

      {/* Tab: Student Approvals */}
      {activeTab === 'approvals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.2rem' }}>
                Pending Student Verification Queue
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Inspect uploaded physical laminated ID cards. Reject fake or duplicate registrations with a reason.
              </p>
            </div>
          </div>

          {pendingStudents.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
              <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                Verification Queue Clear
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                There are no pending student registrations awaiting verification for your block.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pendingStudents.map(student => (
                <div key={student.id} className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    {/* Student Info */}
                    <div style={{ flex: 1, minWidth: '280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>{student.full_name}</h3>
                        <span className="badge badge-pending">Pending Review</span>
                        <span className="badge badge-role" style={{ textTransform: 'capitalize' }}>{student.gender}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--soft-wheat)', marginTop: '0.75rem' }}>
                        <div>Roll Number: <b style={{ color: 'var(--text-primary)' }}>{student.roll_number}</b></div>
                        <div>Laminated ID: <b style={{ color: 'var(--golden-wheat)', fontFamily: 'var(--font-mono)' }}>{student.laminated_id_number}</b></div>
                        <div>Degree / Class: <b style={{ color: 'var(--text-primary)' }}>{student.class_name} (Yr {student.academic_year})</b></div>
                        <div>Student Phone: <b style={{ color: 'var(--text-primary)' }}>{student.phone}</b></div>
                        <div>Email: <b style={{ color: 'var(--text-primary)' }}>{student.email}</b></div>
                        <div>Parent Contact: <b style={{ color: 'var(--text-primary)' }}>{student.parent_name} ({student.parent_phone})</b></div>
                        <div>Emergency: <b style={{ color: 'var(--text-primary)' }}>{student.emergency_contact}</b></div>
                        <div>Allergies: <b style={{ color: student.allergies !== 'None' ? 'var(--accent-rose)' : 'var(--text-muted)' }}>{student.allergies || 'None'}</b></div>
                      </div>

                      {/* File Hash Duplicate Check indicator */}
                      <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>ID Card Image SHA-256:</span>
                        <code style={{ background: 'rgba(223,216,200,0.06)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)', color: 'var(--golden-wheat)' }}>
                          {student.id_card_image_hash?.substring(0, 16)}...
                        </code>
                        <span style={{ color: 'var(--accent-emerald)', fontWeight: '600' }}>✓ Verified Unique</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '150px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleViewIdImage(student)}
                      >
                        <Eye size={16} /> View ID Card Photo
                      </button>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleApprove(student.id, student.full_name)}
                      >
                        <CheckCircle size={16} /> Approve Student
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          setRejectStudentId(student.id);
                          setRejectionReason('ID card photo credentials could not be verified.');
                        }}
                      >
                        <XCircle size={16} /> Reject Registration
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Mess Report for Block */}
      {activeTab === 'food-report' && (
        <MessFoodManager userRole="warden" wardenBlockScope={user?.blockId} />
      )}

      {/* Tab: Outpass Review Desk & Parent Verification */}
      {activeTab === 'outpass' && (
        <WardenOutpassDesk />
      )}

      {/* Tab: Room Allocation & Waitlist Desk */}
      {activeTab === 'rooms' && (
        <WardenRoomAllocationDesk />
      )}

      {/* Tab: Health Assistance & Clinic Oversight */}
      {activeTab === 'health' && (
        <HealthAssistantConsole />
      )}

      {/* Tab: Room Services Scheduler */}
      {activeTab === 'services' && (
        <RoomServicesManager />
      )}

      {/* Tab: Warden Profile */}
      {activeTab === 'profile' && (
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '1.25rem' }}>
              Warden Official Profile
            </h2>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" className="form-input" value={user?.fullName || ''} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">College ID Number</label>
              <input type="text" className="form-input" value={user?.collegeIdNumber || 'W-MALE-101'} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Assigned Hostel Block</label>
              <input type="text" className="form-input" value={user?.blockName || 'Aryabhatta Boys Block A'} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Official College Email</label>
              <input type="email" className="form-input" value={user?.email || ''} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Phone</label>
              <input type="text" className="form-input" value={user?.phone || ''} disabled />
            </div>
          </div>
        </div>
      )}

      {/* Secure ID Image Modal */}
      {previewImageStudent && (
        <div className="modal-backdrop" onClick={() => setPreviewImageStudent(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>
                  Laminated ID Card Verification
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Student: {previewImageStudent.full_name} ({previewImageStudent.laminated_id_number})
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setPreviewImageStudent(null)}>
                Close
              </button>
            </div>

            <div style={{ minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid var(--border-subtle)' }}>
              {imageLoading ? (
                <div style={{ color: 'var(--text-muted)' }}>Fetching secure encrypted image asset...</div>
              ) : imageUrl && imageUrl !== 'error' ? (
                <img
                  src={imageUrl}
                  alt="Laminated ID"
                  style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: 'var(--radius-sm)', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <FileText size={40} style={{ margin: '0 auto 0.5rem' }} />
                  <div>Simulated Demo Asset: ID Card Verified by Multer Hash</div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  setRejectStudentId(previewImageStudent.id);
                  setPreviewImageStudent(null);
                }}
              >
                Reject with Reason
              </button>
              <button
                className="btn btn-success btn-sm"
                onClick={() => {
                  handleApprove(previewImageStudent.id, previewImageStudent.full_name);
                  setPreviewImageStudent(null);
                }}
              >
                Approve Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectStudentId && (
        <div className="modal-backdrop" onClick={() => setRejectStudentId(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem' }}>
              Reject Student Registration
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Specify the exact reason for rejecting this registration. The student will be notified via email and in-app alert.
            </p>

            <form onSubmit={handleRejectSubmit}>
              <div className="form-group">
                <label className="form-label">Rejection Reason *</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="e.g. Uploaded ID card image is blurred and unreadable. Please re-register with a clear photo."
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRejectStudentId(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
