import React, { useState } from 'react';
import { useAuth } from './shared/AuthContext';
import { Navbar } from './shared/Navbar';
import { Login } from './shared/Login';
import { StudentRegistration } from './portals/student/StudentRegistration';
import { WardenRegistration } from './portals/warden/WardenRegistration';
import { StudentDashboard } from './portals/student/StudentDashboard';
import { WardenDashboard } from './portals/warden/WardenDashboard';
import { AdminDashboard } from './portals/staff/AdminDashboard';
import { Shield } from 'lucide-react';

export function App() {
  const { user, loading, isAuthenticated } = useAuth();
  const [viewMode, setViewMode] = useState('login'); // 'login' | 'student_male' | 'student_female' | 'warden'
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--soft-wheat)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="brand-icon" style={{ margin: '0 auto 1.25rem', width: '56px', height: '56px' }}>
            <Shield size={28} color="#191918" />
          </div>
          <div style={{ fontWeight: '700', fontSize: '1.1rem', letterSpacing: '0.02em', color: 'var(--text-primary)' }}>HostelPulse</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--golden-wheat)', marginTop: '0.25rem' }}>Loading Campus Environment...</div>
        </div>
      </div>
    );
  }

  // Not logged in -> Auth screens
  if (!isAuthenticated || !user) {
    if (viewMode === 'student_male') {
      return <StudentRegistration initialGender="male" onBackToLogin={() => setViewMode('login_student')} />;
    }
    if (viewMode === 'student_female') {
      return <StudentRegistration initialGender="female" onBackToLogin={() => setViewMode('login_student')} />;
    }
    if (viewMode === 'warden') {
      return <WardenRegistration onBackToLogin={() => setViewMode('login_warden')} />;
    }
    return (
      <Login
        initialRole={viewMode === 'login_warden' ? 'warden' : 'student'}
        onNavigateRegister={mode => setViewMode(mode)}
      />
    );
  }

  // Authenticated Portal Router
  return (
    <div>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main>
        {user.role === 'student' && <StudentDashboard activeTab={activeTab} />}
        {user.role === 'warden' && <WardenDashboard activeTab={activeTab} />}
        {['admin', 'mess', 'maintenance', 'health_assistant', 'security'].includes(user.role) && (
          <AdminDashboard activeTab={activeTab} />
        )}
      </main>
    </div>
  );
}

export default App;
