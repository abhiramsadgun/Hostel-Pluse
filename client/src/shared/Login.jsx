import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { api } from './api';
import {
  Shield,
  KeyRound,
  User,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  Building,
  Check,
  Clock,
  Compass,
  GraduationCap,
} from 'lucide-react';

export function Login({ initialRole = 'student', onNavigateRegister }) {
  const { login } = useAuth();
  const [activeRole, setActiveRole] = useState(initialRole); // 'student' | 'warden'
  const [identifier, setIdentifier] = useState(initialRole === 'student' ? 'HID-BBA-001' : 'W-MALE-101');
  const [password, setPassword] = useState('Password@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = request email, 2 = enter OTP + new pass
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState(null);
  const [forgotError, setForgotError] = useState(null);

  function handleRoleSwitch(role) {
    setActiveRole(role);
    setError(null);
    if (role === 'student') {
      setIdentifier('HID-BBA-001');
    } else {
      setIdentifier('W-MALE-101');
    }
    setPassword('Password@123');
  }

  async function handleLogin(e) {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, password);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  function handleQuickFill(id, pass) {
    setIdentifier(id);
    setPassword(pass);
    setError(null);
  }

  async function handleRequestOtp(e) {
    e.preventDefault();
    setForgotError(null);
    try {
      const res = await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotSuccessMsg(res.data?.message || 'Verification code sent!');
      if (res.data?.demoOtp) {
        setOtpCode(res.data.demoOtp); // prefill for easy test
      }
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.message || 'Failed to request password reset.');
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setForgotError(null);
    try {
      const res = await api.post('/auth/reset-password', {
        email: forgotEmail,
        otp: otpCode,
        newPassword,
      });
      setForgotSuccessMsg(res.data?.message || 'Password successfully reset! You can now log in.');
      setTimeout(() => {
        setShowForgotModal(false);
        setPassword(newPassword);
        setIdentifier(forgotEmail);
        setForgotStep(1);
      }, 1500);
    } catch (err) {
      setForgotError(err.message || 'Failed to reset password.');
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1.5rem' }}>
      <div
        style={{
          width: '100%',
          maxWidth: '1120px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '2.5rem',
          alignItems: 'stretch',
        }}
      >
        {/* Left Column: Architectural Photo Showcase Juxtaposed with Bold Flat Elements */}
        <div
          className="flat-card"
          style={{
            position: 'relative',
            minHeight: '520px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '2.5rem',
            border: '1px solid var(--border-medium)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Architectural Background Photography */}
          <img
            src="https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80"
            alt="Modern Residence Hall Architecture"
            className="photo-hero-image"
          />

          {/* Deep Contrast Overlay with subtle golden wheat warmth */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(37, 37, 35, 0.85) 0%, rgba(37, 37, 35, 0.6) 40%, rgba(25, 25, 24, 0.95) 100%)',
              zIndex: 1,
            }}
          />

          {/* Top Layer: Flat Soft Wheat Badge & Editorial Header */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <span className="flat-wheat-badge">
                <Compass size={14} /> CAMPUS RESIDENCE INTELLIGENCE
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: 'var(--golden-wheat)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                HOSTELPULSE v2.0
              </span>
            </div>

            <h2
              style={{
                fontSize: '2.25rem',
                fontWeight: '800',
                lineHeight: '1.2',
                color: 'var(--text-primary)',
                marginBottom: '1rem',
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.02em',
              }}
            >
              Elevating Student Residence Life with{' '}
              <span style={{ color: 'var(--golden-wheat)' }}>Precision</span> &amp; Transparency.
            </h2>

            <p style={{ color: 'var(--soft-wheat)', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '420px' }}>
              Designed for modern campus hostels. Streamlined physical ID verification, transparent warden communications,
              and intelligent mess meal preferences.
            </p>
          </div>

          {/* Middle Floating Flat Color Card: Strong Juxtaposition */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              margin: '1.75rem 0',
              padding: '1.25rem 1.5rem',
              backgroundColor: 'var(--deep-gray)',
              border: '1px solid var(--border-medium)',
              borderLeft: '4px solid var(--golden-wheat)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--golden-wheat)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Standard Resident Protocol
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--soft-wheat)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Check size={16} color="var(--golden-wheat)" />
                <span>Verified physical Laminated ID cards for student check-ins</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Check size={16} color="var(--golden-wheat)" />
                <span>Automated 9:00 PM kitchen cut-off for daily meal preferences</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Check size={16} color="var(--golden-wheat)" />
                <span>Emergency contact relay &amp; immediate warden response</span>
              </div>
            </div>
          </div>

          {/* Bottom Layer: Crisp Stat Pills Juxtaposed over Deep Ground */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '1.25rem',
            }}
          >
            <div
              style={{
                background: 'rgba(37, 37, 35, 0.9)',
                border: '1px solid var(--border-subtle)',
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--golden-wheat)' }}>4 Blocks</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Halls</div>
            </div>
            <div
              style={{
                background: 'rgba(37, 37, 35, 0.9)',
                border: '1px solid var(--border-subtle)',
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--golden-wheat)' }}>99.4%</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>SLA Compliance</div>
            </div>
            <div
              style={{
                background: 'rgba(37, 37, 35, 0.9)',
                border: '1px solid var(--border-subtle)',
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--golden-wheat)' }}>2,400+</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Residents</div>
            </div>
          </div>
        </div>

        {/* Right Column: High-Contrast Flat Deep Gray Authentication Card */}
        <div
          className="flat-card"
          style={{
            padding: '2.5rem',
            background: 'var(--deep-gray)',
            border: '1px solid var(--border-medium)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* Brand Header */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div
              className="brand-icon"
              style={{
                width: '56px',
                height: '56px',
                margin: '0 auto 1rem',
                borderRadius: '16px',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              {activeRole === 'student' ? (
                <GraduationCap size={30} color="#191918" />
              ) : (
                <Shield size={30} color="#191918" />
              )}
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.35rem', fontFamily: 'var(--font-display)' }}>
              {activeRole === 'student' ? 'Student Resident' : 'Warden & Staff'}{' '}
              <span style={{ color: 'var(--golden-wheat)' }}>Login</span>
            </h1>
            <p style={{ color: 'var(--soft-wheat)', fontSize: '0.85rem' }}>
              {activeRole === 'student'
                ? 'Sign in with your Laminated Hostel ID, Roll Number, or Email'
                : 'Authorized login for Block Wardens, Kitchen Staff & Administrators'}
            </p>
          </div>

          {/* Role Switcher Tabs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.4rem',
              background: 'rgba(25, 25, 24, 0.65)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.5rem',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => handleRoleSwitch('student')}
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: activeRole === 'student' ? '1px solid var(--border-medium)' : '1px solid transparent',
                background: activeRole === 'student' ? 'var(--golden-wheat)' : 'transparent',
                color: activeRole === 'student' ? '#191918' : 'var(--soft-wheat)',
                fontWeight: '700',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <GraduationCap size={16} /> Student Login
            </button>

            <button
              type="button"
              onClick={() => handleRoleSwitch('warden')}
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: activeRole === 'warden' ? '1px solid var(--border-medium)' : '1px solid transparent',
                background: activeRole === 'warden' ? 'var(--golden-wheat)' : 'transparent',
                color: activeRole === 'warden' ? '#191918' : 'var(--soft-wheat)',
                fontWeight: '700',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Shield size={16} /> Warden &amp; Staff
            </button>
          </div>

          {/* Form alert */}
          {error && (
            <div className="alert alert-error">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">
                {activeRole === 'student' ? 'Student Hostel ID, Roll No, or Email' : 'Warden College ID or Staff Email'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder={
                    activeRole === 'student'
                      ? 'e.g. HID-BBA-001 or 24881A05GE or your email'
                      : 'e.g. W-MALE-101 or admin@hostelpulse.edu'
                  }
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  required
                />
                {activeRole === 'student' ? (
                  <GraduationCap
                    size={18}
                    style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--golden-wheat)' }}
                  />
                ) : (
                  <User
                    size={18}
                    style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--golden-wheat)' }}
                  />
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                {activeRole === 'student' ? (
                  <>Students can use <b>Laminated ID</b> (e.g. HID-BBA-001), <b>Roll Number</b>, or registered <b>Email</b>.</>
                ) : (
                  <>Wardens use <b>College ID</b> (e.g. W-MALE-101); Staff use assigned official email.</>
                )}
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(true);
                    setForgotStep(1);
                    setForgotError(null);
                    setForgotSuccessMsg(null);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--golden-wheat)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}
                >
                  Forgot Password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <Lock
                  size={18}
                  style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--golden-wheat)' }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem', marginTop: '0.5rem', fontSize: '0.95rem' }}
              disabled={loading}
            >
              {loading
                ? 'Authenticating...'
                : activeRole === 'student'
                ? 'Sign In as Student Resident'
                : 'Sign In to Staff Command'}{' '}
              <ArrowRight size={18} />
            </button>
          </form>

          {/* Quick Persona Demo Switcher tailored to active role */}
          <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--golden-wheat)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Sparkles size={14} color="var(--golden-wheat)" />{' '}
              {activeRole === 'student' ? 'Quick Student Test Accounts' : 'Quick Staff Test Accounts'}
            </div>

            {activeRole === 'student' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start', fontSize: '0.75rem' }}
                  onClick={() => handleQuickFill('HID-BBA-001', 'Password@123')}
                >
                  🎓 Rahul (Male Block A)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start', fontSize: '0.75rem' }}
                  onClick={() => handleQuickFill('HID-GBB-001', 'Password@123')}
                >
                  🎓 Ananya (Female Block B)
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start', fontSize: '0.75rem' }}
                  onClick={() => handleQuickFill('W-MALE-101', 'Password@123')}
                >
                  👨‍🏫 Boys Warden (Vikram)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start', fontSize: '0.75rem' }}
                  onClick={() => handleQuickFill('W-FEMA-201', 'Password@123')}
                >
                  👩‍🏫 Girls Warden (Sunita)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start', fontSize: '0.75rem' }}
                  onClick={() => handleQuickFill('admin@hostelpulse.edu', 'Password@123')}
                >
                  🛡️ Chief Warden Admin
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start', fontSize: '0.75rem' }}
                  onClick={() => handleQuickFill('mess@hostelpulse.edu', 'Password@123')}
                >
                  🍲 Mess Operations
                </button>
              </div>
            )}
          </div>

          {/* New Account Registration Links */}
          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)' }}>
              {activeRole === 'student' ? 'Need a new student hostel account?' : 'Need a warden account?'}
            </div>
            {activeRole === 'student' ? (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onNavigateRegister('student_male')}
                >
                  Register as Male Student
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onNavigateRegister('student_female')}
                >
                  Register as Female Student
                </button>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => onNavigateRegister('warden')}
                  style={{ background: 'none', border: 'none', color: 'var(--golden-wheat)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', fontWeight: '600' }}
                >
                  Hostel Warden Registration &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password OTP Modal */}
      {showForgotModal && (
        <div className="modal-backdrop" onClick={() => setShowForgotModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem', fontFamily: 'var(--font-display)' }}>
              <KeyRound size={20} style={{ display: 'inline', marginRight: '6px', color: 'var(--golden-wheat)' }} />
              Reset Your Password
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', marginBottom: '1.25rem' }}>
              {forgotStep === 1
                ? 'Enter your registered college email address to receive a 6-digit OTP verification code.'
                : `Enter the 6-digit code dispatched to ${forgotEmail} and choose a new password.`}
            </p>

            {forgotError && <div className="alert alert-error">{forgotError}</div>}
            {forgotSuccessMsg && <div className="alert alert-success">{forgotSuccessMsg}</div>}

            {forgotStep === 1 ? (
              <form onSubmit={handleRequestOtp}>
                <div className="form-group">
                  <label className="form-label">Registered Email</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="email"
                      className="form-input"
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder="e.g. rahul.sharma@college.edu"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      required
                    />
                    <Mail
                      size={18}
                      style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--golden-wheat)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowForgotModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Send Verification Code
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword}>
                <div className="form-group">
                  <label className="form-label">6-Digit Verification Code</label>
                  <input
                    type="text"
                    className="form-input"
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value)}
                    required
                    style={{ letterSpacing: '0.25em', fontSize: '1.2rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Choose a strong password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setForgotStep(1)}
                  >
                    Back
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save New Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
