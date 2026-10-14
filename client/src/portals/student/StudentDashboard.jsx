import React, { useState, useEffect } from 'react';
import { useAuth } from '../../shared/AuthContext';
import { api } from '../../shared/api';
import {
  Shield,
  User,
  Phone,
  Mail,
  Building,
  Utensils,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Lock,
  HeartPulse,
  Save,
  Moon,
} from 'lucide-react';

import { StudentFoodPortal } from './StudentFoodPortal';
import { StudentComplaintPortal } from './StudentComplaintPortal';
import { RoomServicesWidget } from './RoomServicesWidget';
import { StudentOutpassPortal } from './StudentOutpassPortal';
import { StudentHealthPortal } from './StudentHealthPortal';
import { StudentRoomAllocation } from './StudentRoomAllocation';

export function StudentDashboard({ activeTab = 'dashboard' }) {
  const { user, assignedWardens, refreshProfile } = useAuth();
  const student = user?.student;

  // Profile update state
  const [phone, setPhone] = useState(user?.phone || '');
  const [allergies, setAllergies] = useState(student?.allergies || '');
  const [emergencyContact, setEmergencyContact] = useState(student?.emergencyContact || '');
  const [parentPhone, setParentPhone] = useState(student?.parentPhone || '');
  const [dietPreference, setDietPreference] = useState(student?.dietPreference || user?.dietPreference || 'veg');
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileError, setProfileError] = useState(null);

  async function handleUpdateProfile(e) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileError(null);
    try {
      const res = await api.put('/auth/profile', {
        phone,
        allergies,
        emergencyContact,
        parentPhone,
      });
      if (res.success) {
        try {
          await api.put('/food/diet-preference', { dietPreference });
        } catch (fErr) {
          console.warn('Diet preference update warning:', fErr.message);
        }
        setProfileMsg('Profile and default diet preference updated successfully.');
        refreshProfile();
      }
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    }
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '2rem auto', padding: '0 1.25rem' }}>
      {/* Tab: Dashboard / Assigned Warden Overview */}
      {activeTab === 'dashboard' && (
        <div>
          {/* Architectural Photo Hero Banner Juxtaposed with Flat Deep Gray Elements */}
          <div className="photo-hero-banner">
            <img
              src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80"
              alt="Campus Residence Hall"
              className="photo-hero-image"
            />
            <div className="photo-hero-overlay">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                    <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>
                      Active Resident
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                      HOSTEL RESIDENCE PORTAL
                    </span>
                  </div>
                  <h1 style={{ fontSize: '1.9rem', fontWeight: '800', marginBottom: '0.35rem', fontFamily: 'var(--font-display)' }}>
                    Welcome back, {student?.fullName || user?.fullName}
                  </h1>
                  <p style={{ color: 'var(--soft-wheat)', fontSize: '0.9rem' }}>
                    Hostel Laminated ID: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--golden-wheat)', fontWeight: '700' }}>{student?.laminatedIdNumber}</span> &bull; Roll No: <span style={{ color: 'var(--soft-wheat)' }}>{student?.rollNumber}</span>
                  </p>
                </div>

                {/* Flat Contrast Status Blocks */}
                <div style={{ display: 'flex', gap: '0.85rem' }}>
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
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assigned Block</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--golden-wheat)' }}>{student?.blockName || 'Block A'}</div>
                  </div>
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
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Allocated Room</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--golden-wheat)' }}>{student?.roomNumber || 'Room 101'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Assigned Warden Information Card (Primary and Deputy) */}
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)' }}>
              <Shield size={22} color="var(--golden-wheat)" /> Assigned Hostel Wardens
            </h2>

            <div className="grid-2">
              {assignedWardens.map(w => (
                <div key={w.id} className="flat-card" style={{ padding: '1.5rem', display: 'flex', gap: '1.25rem', alignItems: 'center', border: '1px solid var(--border-subtle)' }}>
                  {/* Warden Photo / Avatar */}
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      background: 'var(--grad-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.75rem',
                      fontWeight: '800',
                      color: 'var(--deep-gray)',
                      boxShadow: '0 4px 14px rgba(163, 146, 116, 0.35)',
                      flexShrink: 0,
                    }}
                  >
                    {w.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span className={`badge ${w.is_night_deputy ? 'badge-role' : 'badge-approved'}`} style={{ fontSize: '0.7rem' }}>
                        {w.is_night_deputy ? 'Night / Deputy Warden' : 'Chief Block Warden'}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                      {w.full_name}
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--soft-wheat)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                      <Phone size={14} color="var(--accent-emerald)" /> <b>{w.phone}</b>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Mail size={14} color="var(--golden-wheat)" /> {w.email}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="grid-3">
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <Utensils size={28} color="#f59e0b" style={{ marginBottom: '0.75rem' }} />
              <h4 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>Daily Mess Preference</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Select vegetarian, non-veg, or dietary meal options before the 9:00 PM cut-off.
              </p>
              <span className="badge badge-pending">Locks 9:00 PM Daily</span>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <HeartPulse size={28} color="#ef4444" style={{ marginBottom: '0.75rem' }} />
              <h4 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>Medical & Allergy Note</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Registered allergies: <b>{student?.allergies || 'None'}</b>
              </p>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Emergency: {student?.emergencyContact || 'Not configured'}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <Building size={28} color="#10b981" style={{ marginBottom: '0.75rem' }} />
              <h4 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>Hostel Rules & Outpass</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Campus gate closes at 10:00 PM. Digital outpasses integrate directly with mess reports.
              </p>
              <span className="badge badge-active">Module Ready</span>
            </div>
          </div>

          {/* Room Services Widget: Live room housekeeping, laundry & pest control schedules */}
          <div style={{ marginTop: '2.5rem' }}>
            <RoomServicesWidget />
          </div>
        </div>
      )}

      {/* Tab: Complaints & AI Tracker */}
      {activeTab === 'complaints' && (
        <StudentComplaintPortal user={user} />
      )}

      {/* Tab: Outpass Clearance & Digital QR */}
      {activeTab === 'outpass' && (
        <StudentOutpassPortal />
      )}

      {/* Tab: Health Assistance & Emergency SOS */}
      {activeTab === 'health' && (
        <StudentHealthPortal />
      )}

      {/* Tab: Room Allocation & Peer Groups */}
      {activeTab === 'rooms' && (
        <StudentRoomAllocation />
      )}

      {/* Tab: Food Module */}
      {activeTab === 'food' && (
        <StudentFoodPortal user={user} onProfileUpdated={refreshProfile} />
      )}

      {/* Tab: Student Profile */}
      {activeTab === 'profile' && (
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '1.25rem' }}>
              Student Profile & Emergency Records
            </h2>

            {profileMsg && <div className="alert alert-success">{profileMsg}</div>}
            {profileError && <div className="alert alert-error">{profileError}</div>}

            <form onSubmit={handleUpdateProfile}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-input" value={student?.fullName || user?.fullName} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">Laminated Hostel ID</label>
                  <input type="text" className="form-input" value={student?.laminatedIdNumber || ''} disabled />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Roll Number</label>
                  <input type="text" className="form-input" value={student?.rollNumber || ''} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">College Email</label>
                  <input type="email" className="form-input" value={user?.email || ''} disabled />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Hostel Block</label>
                  <input type="text" className="form-input" value={student?.blockName || 'Aryabhatta Boys Block A'} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">Allocated Room</label>
                  <input type="text" className="form-input" value={student?.roomNumber ? `Room ${student.roomNumber} (Floor ${student.floor})` : 'Room 101'} disabled />
                </div>
              </div>

              <hr style={{ borderColor: 'var(--border-subtle)', margin: '1.5rem 0' }} />

              <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--golden-wheat)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Mess & Dining Profile Preference
              </div>

              {/* Diet Preference Selector */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Default Base Diet Preference *</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)' }}>
                    Serves as default when you don't choose before 9 PM
                  </span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: dietPreference === 'veg' ? '2px solid var(--accent-emerald)' : '1px solid var(--border-medium)',
                      background: dietPreference === 'veg' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      color: dietPreference === 'veg' ? 'var(--accent-emerald)' : 'var(--soft-wheat)',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                    onClick={() => setDietPreference('veg')}
                  >
                    🌱 Vegetarian
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: dietPreference === 'non_veg' ? '2px solid var(--golden-wheat)' : '1px solid var(--border-medium)',
                      background: dietPreference === 'non_veg' ? 'rgba(163, 146, 116, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                      color: dietPreference === 'non_veg' ? 'var(--golden-wheat)' : 'var(--soft-wheat)',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                    onClick={() => setDietPreference('non_veg')}
                  >
                    🍗 Non-Vegetarian
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--golden-wheat)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Editable Contact Details
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Student Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Parent Contact Phone</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={parentPhone}
                    onChange={e => setParentPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Emergency Contact Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={emergencyContact}
                    onChange={e => setEmergencyContact(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Food Allergies / Medical Condition</label>
                  <input
                    type="text"
                    className="form-input"
                    value={allergies}
                    onChange={e => setAllergies(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.75rem', width: '100%', padding: '0.85rem' }}>
                <Save size={18} /> Save Updated Details & Diet Preference
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
