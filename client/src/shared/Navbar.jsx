import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { api } from './api';
import {
  Bell,
  LogOut,
  User,
  Shield,
  Utensils,
  Layers,
  CheckCircle,
  AlertTriangle,
  Info,
  Building,
  Menu,
  X,
  Wrench,
  FileText,
  Compass,
  HeartPulse,
  DoorOpen,
  Ambulance,
  QrCode,
  Package,
} from 'lucide-react';

export function Navbar({ activeTab, setActiveTab }) {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function fetchNotifications() {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      if (res.success) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (e) {
      // non-critical
    }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  async function handleMarkRead(id) {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {}
  }

  async function handleMarkAllRead() {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {}
  }

  const renderNavLinks = () => {
    if (!user) return null;

    if (user.role === 'student') {
      return (
        <>
          <button
            className={`btn btn-sm ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Shield size={16} /> My Hostel &amp; Services
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'complaints' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('complaints')}
          >
            <Wrench size={16} /> Complaints
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'outpass' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('outpass')}
          >
            <Compass size={16} /> Outpass &amp; QR
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'health' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('health')}
          >
            <HeartPulse size={16} /> Health &amp; SOS
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('rooms')}
          >
            <DoorOpen size={16} /> Room Allocation
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'food' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('food')}
          >
            <Utensils size={16} /> Mess Menu
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={16} /> Profile
          </button>
        </>
      );
    }

    if (user.role === 'warden') {
      return (
        <>
          <button
            className={`btn btn-sm ${activeTab === 'complaints' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('complaints')}
          >
            <Wrench size={16} /> Complaints
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'outpass' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('outpass')}
          >
            <Compass size={16} /> Outpass Desk
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('rooms')}
          >
            <DoorOpen size={16} /> Room Allocation
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'health' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('health')}
          >
            <HeartPulse size={16} /> Health Clinic
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'services' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('services')}
          >
            <Building size={16} /> Room Services
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'approvals' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('approvals')}
          >
            <CheckCircle size={16} /> Approvals
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'food-report' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('food-report')}
          >
            <Utensils size={16} /> Mess
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={16} /> Profile
          </button>
        </>
      );
    }

    if (user.role === 'security') {
      return (
        <>
          <button
            className={`btn btn-sm ${activeTab === 'gate' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('gate')}
          >
            <QrCode size={16} /> Gate Clearance Terminal
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'outpass' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('outpass')}
          >
            <Compass size={16} /> Outpass Records
          </button>
        </>
      );
    }

    if (user.role === 'health_assistant') {
      return (
        <>
          <button
            className={`btn btn-sm ${activeTab === 'health' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('health')}
          >
            <HeartPulse size={16} /> Clinic Triage &amp; Dispensary
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'complaints' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('complaints')}
          >
            <Wrench size={16} /> Complaints
          </button>
        </>
      );
    }

    if (user.role === 'maintenance') {
      return (
        <>
          <button
            className={`btn btn-sm ${activeTab === 'tasks' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('tasks')}
          >
            <Wrench size={16} /> My Work Orders
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'services' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('services')}
          >
            <Building size={16} /> Room Services Schedules
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'complaints' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('complaints')}
          >
            <Layers size={16} /> All Complaints
          </button>
        </>
      );
    }

    // Admin role
    return (
      <>
        <button
          className={`btn btn-sm ${activeTab === 'stats' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('stats')}
        >
          <Layers size={16} /> Overview
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'complaints' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('complaints')}
        >
          <Wrench size={16} /> Complaints
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'outpass' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('outpass')}
        >
          <Compass size={16} /> Outpasses
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('rooms')}
        >
          <DoorOpen size={16} /> Room Allocations
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'health' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('health')}
        >
          <HeartPulse size={16} /> Health Desk
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'services' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('services')}
        >
          <Building size={16} /> Room Services
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('reports')}
        >
          <FileText size={16} /> Reports
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'infrastructure' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('infrastructure')}
        >
          <Building size={16} /> Blocks &amp; Rooms
        </button>
      </>
    );
  };

  return (
    <nav className="navbar">
      {/* Left: Brand */}
      <div className="brand-badge" onClick={() => setActiveTab(user?.role === 'warden' ? 'complaints' : user?.role === 'maintenance' ? 'tasks' : 'dashboard')}>
        <div className="brand-icon">
          <Shield size={22} color="#191918" />
        </div>
        <div>
          <div className="brand-title">
            Hostel<span style={{ color: 'var(--golden-wheat)' }}>Pulse</span>
            <span className="brand-pill">Core</span>
          </div>
        </div>
      </div>

      {/* Middle: Navigation tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }} className="desktop-nav">
        {renderNavLinks()}
      </div>

      {/* Right: Notification Bell & User Pill */}
      <div className="user-nav-actions">
        {user ? (
          <>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-secondary"
                style={{
                  position: 'relative',
                  padding: '0.6rem',
                  borderRadius: '50%',
                  width: '42px',
                  height: '42px',
                }}
                onClick={() => {
                  setShowNotifMenu(!showNotifMenu);
                  if (!showNotifMenu) fetchNotifications();
                }}
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-3px',
                      right: '-3px',
                      background: 'var(--accent-rose)',
                      color: 'white',
                      fontSize: '0.65rem',
                      fontWeight: '800',
                      borderRadius: '999px',
                      padding: '2px 6px',
                      border: '2px solid var(--bg-surface)',
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {showNotifMenu && (
                <div className="notif-menu">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>Notifications ({notifications.length})</div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        style={{ background: 'none', border: 'none', color: 'var(--golden-wheat)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                          onClick={() => handleMarkRead(n.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                            <span style={{ fontWeight: '600', fontSize: '0.8rem', color: !n.is_read ? 'var(--golden-wheat)' : 'var(--text-primary)' }}>
                              {n.title}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                            {n.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ textAlign: 'right' }} className="user-text-pill">
                <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>{user.fullName}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {user.role} {user.blockName ? `• ${user.blockName}` : ''}
                </div>
              </div>
              <span className={`badge badge-${user.role === 'admin' ? 'role' : 'approved'}`}>
                {user.role}
              </span>
              <button
                id="global-logout-btn"
                className="btn btn-secondary btn-sm"
                onClick={logout}
                title="Log Out"
                style={{ padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <LogOut size={15} /> Logout
              </button>
            </div>
          </>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Hostel Complaint Management System
          </div>
        )}
      </div>
    </nav>
  );
}
