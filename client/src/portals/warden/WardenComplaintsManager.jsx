import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import { BarChart, DonutChart } from '../../shared/Charts';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Search,
  UserCheck,
  Zap,
  Droplet,
  Home,
  Trash2,
  Wifi,
  Utensils,
  Shield,
  Wrench,
  Flame,
  ArrowUpDown,
  RefreshCw,
  GitMerge,
  Star,
  Eye,
  EyeOff,
  X,
  Send,
  Building,
  BarChart2,
  Layers,
  ChevronRight,
} from 'lucide-react';

const CATEGORY_ICONS = {
  plumbing: <Droplet size={16} color="#38bdf8" />,
  electrical: <Zap size={16} color="#facc15" />,
  furniture: <Home size={16} color="#fb923c" />,
  cleanliness: <Trash2 size={16} color="#4ade80" />,
  internet: <Wifi size={16} color="#818cf8" />,
  mess: <Utensils size={16} color="#f472b6" />,
  security: <Shield size={16} color="#f87171" />,
  other: <Wrench size={16} color="#94a3b8" />,
};

export function WardenComplaintsManager({ user }) {
  // Active tab: 'queue' | 'analytics' | 'hotspots'
  const [activeTab, setActiveTab] = useState('queue');

  // Complaints & Pagination
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dietFilter, setDietFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isOverdueOnly, setIsOverdueOnly] = useState(false);
  const [isRecurringOnly, setIsRecurringOnly] = useState(false);
  const [sortBy, setSortBy] = useState('priority');

  // Analytics & Hotspots
  const [analytics, setAnalytics] = useState(null);
  const [hotspots, setHotspots] = useState([]);

  // Detail Modal & Staff Auto-Suggestion
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [staffSuggestions, setStaffSuggestions] = useState([]);
  const [assignNote, setAssignNote] = useState('');
  const [statusChangeValue, setStatusChangeValue] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [actionMsg, setActionMsg] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Load Complaints Queue
  async function loadComplaints() {
    setLoading(true);
    setActionError(null);
    try {
      const qParams = new URLSearchParams();
      if (statusFilter !== 'all') qParams.append('status', statusFilter);
      if (categoryFilter !== 'all') qParams.append('category', categoryFilter);
      if (isOverdueOnly) qParams.append('isOverdue', 'true');
      if (isRecurringOnly) qParams.append('isRecurring', 'true');
      if (search.trim()) qParams.append('search', search.trim());
      qParams.append('sortBy', sortBy);
      qParams.append('limit', '50');

      const res = await api.get(`/complaints?${qParams.toString()}`);
      if (res.success) {
        setComplaints(res.data.complaints || []);
        setTotalCount(res.data.pagination?.total || 0);
      }
    } catch (err) {
      setActionError('Failed to load priority queue: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Load Analytics Data
  async function loadAnalytics() {
    try {
      const res = await api.get('/analytics/dashboard');
      if (res.success) {
        setAnalytics(res.data);
      }
    } catch (err) {
      console.warn('Analytics load warn:', err.message);
    }
  }

  // Load Hotspots
  async function loadHotspots() {
    try {
      const res = await api.get('/complaints/hotspots');
      if (res.success) {
        setHotspots(res.data.hotspots || []);
      }
    } catch (err) {
      console.warn('Hotspots load warn:', err.message);
    }
  }

  useEffect(() => {
    loadComplaints();
    loadAnalytics();
    loadHotspots();
  }, [statusFilter, categoryFilter, isOverdueOnly, isRecurringOnly, sortBy]);

  // Open Ticket Details & Auto-Fetch Suggested Staff
  async function handleOpenDetails(id) {
    setActionMsg(null);
    setActionError(null);
    try {
      const res = await api.get(`/complaints/${id}`);
      if (res.success) {
        setSelectedTicket(res.data);
        setStatusChangeValue(res.data.complaint.status);

        // Fetch auto-suggested staff for this category
        const staffRes = await api.get(`/complaints/staff-suggestions?category=${res.data.complaint.category_key}`);
        if (staffRes.success) {
          setStaffSuggestions(staffRes.data.suggestions || []);
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to open ticket details.');
    }
  }

  // 1-Click Assign Staff
  async function handleAssignStaff(staffId, staffName) {
    if (!selectedTicket) return;
    try {
      const res = await api.post(`/complaints/${selectedTicket.complaint.id}/assign`, {
        staffId,
        note: assignNote || `Dispatched by Warden ${user?.fullName}`,
      });
      if (res.success) {
        setActionMsg(`Ticket assigned to ${staffName} successfully.`);
        setAssignNote('');
        handleOpenDetails(selectedTicket.complaint.id);
        loadComplaints();
        loadAnalytics();
      }
    } catch (err) {
      setActionError(err.message || 'Assignment failed.');
    }
  }

  // Change Status
  async function handleUpdateStatus() {
    if (!selectedTicket) return;
    try {
      const res = await api.post(`/complaints/${selectedTicket.complaint.id}/status`, {
        status: statusChangeValue,
        notes: statusNote || `Status updated by Warden ${user?.fullName}`,
      });
      if (res.success) {
        setActionMsg(`Status changed to ${statusChangeValue}.`);
        setStatusNote('');
        handleOpenDetails(selectedTicket.complaint.id);
        loadComplaints();
        loadAnalytics();
      }
    } catch (err) {
      setActionError(err.message || 'Status change failed.');
    }
  }

  // Merge into Parent Ticket
  async function handleMerge(parentId, parentComplaintId) {
    if (!selectedTicket) return;
    if (!confirm(`Merge ticket #${selectedTicket.complaint.complaint_id} into #${parentComplaintId}?`)) return;
    try {
      const res = await api.post(`/complaints/${selectedTicket.complaint.id}/merge`, { parentId });
      if (res.success) {
        setActionMsg(`Merged successfully into #${parentComplaintId}.`);
        setSelectedTicket(null);
        loadComplaints();
        loadAnalytics();
      }
    } catch (err) {
      alert(err.message || 'Merge failed.');
    }
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Top Banner & KPI Metrics */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card-contrast">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Queue Size
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--golden-wheat)', marginTop: '0.35rem', fontFamily: 'var(--font-display)' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)', marginTop: '0.2rem' }}>
            Active Tickets in Block
          </div>
        </div>

        <div className="stat-card-contrast" style={{ borderTop: analytics?.overdueCount > 0 ? '3px solid var(--accent-rose)' : '3px solid var(--golden-wheat)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Overdue SLA Breaches
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: analytics?.overdueCount > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', marginTop: '0.35rem', fontFamily: 'var(--font-display)' }}>
            {analytics?.overdueCount || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)', marginTop: '0.2rem' }}>
            Exceeded Target Turnaround
          </div>
        </div>

        <div className="stat-card-contrast" style={{ borderTop: hotspots.length > 0 ? '3px solid var(--accent-amber)' : '3px solid var(--golden-wheat)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Recurring Hotspots
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: hotspots.length > 0 ? 'var(--accent-amber)' : 'var(--soft-wheat)', marginTop: '0.35rem', fontFamily: 'var(--font-display)' }}>
            {hotspots.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)', marginTop: '0.2rem' }}>
            3+ Incidents in 30 Days
          </div>
        </div>

        <div className="stat-card-contrast">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Resident Satisfaction
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--accent-emerald)', marginTop: '0.35rem', fontFamily: 'var(--font-display)' }}>
            ★ {analytics?.satisfaction?.averageRating || '4.5'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)', marginTop: '0.2rem' }}>
            From {analytics?.satisfaction?.totalFeedback || 0} ratings
          </div>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-medium)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
        <button
          className={`btn btn-sm ${activeTab === 'queue' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('queue')}
        >
          <Flame size={16} /> Dynamic Priority Queue ({totalCount})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart2 size={16} /> Recharts &amp; Visual Analytics
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'hotspots' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('hotspots')}
        >
          <AlertTriangle size={16} /> Hotspot Alerts ({hotspots.length})
        </button>
      </div>

      {/* TAB 1: PRIORITY QUEUE */}
      {activeTab === 'queue' && (
        <div>
          {/* Filter Bar */}
          <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Search */}
              <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2rem' }}
                  placeholder="Search by ID, keyword, room or student..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <select className="form-select" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="Submitted">Submitted (New)</option>
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>

              {/* Category Filter */}
              <select className="form-select" style={{ width: 'auto' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                <option value="electrical">Electrical</option>
                <option value="plumbing">Plumbing</option>
                <option value="furniture">Furniture</option>
                <option value="cleanliness">Cleanliness</option>
                <option value="internet">Wi-Fi / LAN</option>
                <option value="mess">Mess &amp; Food</option>
                <option value="security">Security</option>
                <option value="other">Other</option>
              </select>

              {/* Sort By */}
              <select className="form-select" style={{ width: 'auto' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="priority">Sort by Priority Score (Highest First)</option>
                <option value="waiting">Sort by Longest Waiting Time</option>
                <option value="newest">Sort by Most Recent</option>
              </select>

              {/* Dietary Filter */}
              <select className="form-select" style={{ width: 'auto' }} value={dietFilter} onChange={e => setDietFilter(e.target.value)}>
                <option value="all">All Diets ({complaints.length})</option>
                <option value="non_veg">🍗 Non-Veg Residents ({complaints.filter(c => c.student_diet_preference === 'non_veg').length})</option>
                <option value="veg">🌱 Veg Residents ({complaints.filter(c => c.student_diet_preference === 'veg').length})</option>
              </select>

              {/* Badges Toggle & Live Dietary Count */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 8px' }}>
                  🍗 Non-Veg: <b>{complaints.filter(c => c.student_diet_preference === 'non_veg').length}</b>
                </span>
                <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '4px 8px' }}>
                  🌱 Veg: <b>{complaints.filter(c => c.student_diet_preference === 'veg').length}</b>
                </span>

                <button
                  className={`btn btn-sm ${isOverdueOnly ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => setIsOverdueOnly(!isOverdueOnly)}
                >
                  Overdue Only
                </button>
                <button
                  className={`btn btn-sm ${isRecurringOnly ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setIsRecurringOnly(!isRecurringOnly)}
                >
                  Recurring Only
                </button>
                <button className="btn btn-secondary btn-sm" onClick={loadComplaints} title="Refresh">
                  <RefreshCw size={14} className={loading ? 'spin' : ''} />
                </button>
              </div>
            </div>
          </div>

          {/* Queue Table */}
          {complaints.filter(c => dietFilter === 'all' || c.student_diet_preference === dietFilter).length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No complaints match the specified filters.
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Priority</th>
                    <th style={{ padding: '0.85rem 1rem' }}>ID &amp; Title</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Category</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Location</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Resident &amp; Diet</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Assigned To</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints
                    .filter(c => dietFilter === 'all' || c.student_diet_preference === dietFilter)
                    .map(c => {
                    const score = Number(c.priority_score) || 0;
                    const scoreBg = score >= 85 ? 'rgba(239, 68, 68, 0.2)' : score >= 60 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(163, 146, 116, 0.2)';
                    const scoreColor = score >= 85 ? 'var(--accent-rose)' : score >= 60 ? 'var(--accent-amber)' : 'var(--golden-wheat)';

                    return (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          transition: 'background 0.15s ease',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleOpenDetails(c.id)}
                        className="table-row-hover"
                      >
                        {/* Priority Score Pillar */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span
                              style={{
                                background: scoreBg,
                                color: scoreColor,
                                border: `1px solid ${scoreColor}`,
                                fontWeight: '800',
                                fontFamily: 'var(--font-mono)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.85rem',
                              }}
                            >
                              {score.toFixed(1)}
                            </span>
                            {c.affected_count > 1 && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--golden-wheat)', fontWeight: '700' }} title="Multiple students affected">
                                +{c.affected_count - 1} upvotes
                              </span>
                            )}
                          </div>
                        </td>

                        {/* ID & Title with Badges */}
                        <td style={{ padding: '0.85rem 1rem', maxWidth: '300px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--golden-wheat)', fontSize: '0.8rem' }}>
                              {c.complaint_id}
                            </span>
                            {c.is_overdue && (
                              <span className="badge badge-rejected" style={{ fontSize: '0.65rem' }}>Overdue</span>
                            )}
                            {c.is_recurring && (
                              <span className="badge badge-pending" style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.2)', color: 'var(--accent-amber)' }}>
                                Hotspot
                              </span>
                            )}
                            {c.is_anonymous && (
                              <span className="badge badge-role" style={{ fontSize: '0.65rem' }}>
                                <EyeOff size={10} /> Anon
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.title}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Lodged {new Date(c.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        </td>

                        {/* Category */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', textTransform: 'capitalize' }}>
                            {CATEGORY_ICONS[c.category_key] || <Wrench size={14} />}
                            <span>{c.category_key}</span>
                          </div>
                        </td>

                        {/* Location */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            {c.room_number ? `Room ${c.room_number}` : 'Common Area'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.block_code || 'BBA'}</div>
                        </td>

                        {/* Resident & Diet */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{c.student_name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.student_lam_id}</span>
                            {c.student_diet_preference === 'non_veg' ? (
                              <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1px 5px' }}>
                                🍗 Non-Veg
                              </span>
                            ) : (
                              <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '1px 5px' }}>
                                🌱 Veg
                              </span>
                            )}
                          </div>
                          {c.student_allergies && c.student_allergies !== 'None' && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--accent-amber)', marginTop: '0.15rem' }}>
                              ⚠️ {c.student_allergies}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span
                            className={`badge ${
                              c.status === 'Resolved' || c.status === 'Closed'
                                ? 'badge-approved'
                                : c.status === 'In Progress'
                                ? 'badge-role'
                                : 'badge-pending'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>

                        {/* Assigned To */}
                        <td style={{ padding: '0.85rem 1rem', color: c.assigned_staff_name ? 'var(--golden-wheat)' : 'var(--text-muted)' }}>
                          {c.assigned_staff_name || 'Unassigned'}
                        </td>

                        {/* Action */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={e => {
                              e.stopPropagation();
                              handleOpenDetails(c.id);
                            }}
                          >
                            Dispatch <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RECHARTS & VISUAL ANALYTICS */}
      {activeTab === 'analytics' && analytics && (
        <div>
          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
            {/* Chart 1: Category Distribution */}
            <div className="flat-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', fontFamily: 'var(--font-display)' }}>
                  Complaints by Category
                </h3>
                <span className="badge badge-role">Breakdown</span>
              </div>
              <DonutChart
                data={(analytics.categoryDistribution || []).map(cd => ({
                  name: cd.category_key,
                  value: parseInt(cd.count, 10),
                }))}
                height={230}
              />
            </div>

            {/* Chart 2: Pending vs Resolved Status Overview */}
            <div className="flat-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', fontFamily: 'var(--font-display)' }}>
                  Pending vs. Resolved Turnaround
                </h3>
                <span className="badge badge-approved">
                  {analytics.statusOverview?.resolved || 0} Resolved
                </span>
              </div>
              <BarChart
                data={[
                  { name: 'Submitted', value: analytics.statusOverview?.breakdown?.Submitted || 0, color: 'var(--golden-wheat)' },
                  { name: 'Assigned', value: analytics.statusOverview?.breakdown?.Assigned || 0, color: 'var(--accent-amber)' },
                  { name: 'In Progress', value: analytics.statusOverview?.breakdown?.['In Progress'] || 0, color: 'var(--accent-blue)' },
                  { name: 'Resolved', value: analytics.statusOverview?.breakdown?.Resolved || 0, color: 'var(--accent-emerald)' },
                  { name: 'Closed', value: analytics.statusOverview?.breakdown?.Closed || 0, color: 'var(--text-muted)' },
                ]}
                xKey="name"
                yKey="value"
                height={230}
              />
            </div>
          </div>

          <div className="grid-2">
            {/* Chart 3: Average Resolution Time by Category */}
            <div className="flat-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', fontFamily: 'var(--font-display)' }}>
                  Average Resolution Time (Hours)
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)' }}>Empirical Telemetry</span>
              </div>
              <BarChart
                data={(analytics.avgResolutionTimeByCategory || []).map(ar => ({
                  name: ar.category_key,
                  value: parseFloat(ar.avg_hours),
                }))}
                xKey="name"
                yKey="value"
                height={220}
                color="var(--accent-emerald)"
              />
            </div>

            {/* Repeat Issues per Room */}
            <div className="flat-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', fontFamily: 'var(--font-display)' }}>
                  Repeat Issues Per Room (Top Hotspots)
                </h3>
                <span className="badge badge-pending">Frequent Maintenance</span>
              </div>
              {analytics.repeatIssuesPerRoom && analytics.repeatIssuesPerRoom.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {analytics.repeatIssuesPerRoom.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div>
                        <b style={{ color: 'var(--golden-wheat)' }}>Room {r.room_number}</b> &bull; <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.block_name}</span>
                      </div>
                      <span className="badge badge-role">{r.complaint_count} incidents</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No high-frequency repeating rooms currently flagged.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RECURRING HOTSPOT ALERTS */}
      {activeTab === 'hotspots' && (
        <div>
          <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Rooms and blocks where <b>3 or more complaints</b> occurred within 30 days. Investigate root causes (e.g. corroded main pipes or aging electrical wiring).
          </div>

          {hotspots.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
              <CheckCircle size={44} color="var(--accent-emerald)" style={{ margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>No Active Recurring Hotspots</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No room or block has experienced 3+ repeated incidents within the 30-day window.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {hotspots.map(h => (
                <div key={h.id} className="flat-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-amber)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <span className="badge badge-pending" style={{ background: 'rgba(245, 158, 11, 0.2)', color: 'var(--accent-amber)' }}>
                          Recurring Hotspot Alert
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', textTransform: 'capitalize', fontWeight: '700' }}>
                          Category: {h.category_key}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                        {h.room_number ? `Room ${h.room_number}` : 'Block Common Area'} &bull; {h.block_name}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)' }}>
                        Identified <b>{h.occurrence_count} recurring incidents</b> flagged between {new Date(h.first_reported_at).toLocaleDateString()} and {new Date(h.last_reported_at).toLocaleDateString()}.
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setCategoryFilter(h.category_key);
                          setActiveTab('queue');
                        }}
                      >
                        Inspect Queue Tickets
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DISPATCH & DETAIL MODAL */}
      {selectedTicket && (
        <div className="modal-backdrop" onClick={() => setSelectedTicket(null)}>
          <div className="modal-card" style={{ maxWidth: '780px' }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--golden-wheat)', fontSize: '0.95rem' }}>
                    {selectedTicket.complaint.complaint_id}
                  </span>
                  <span className="badge badge-approved">{selectedTicket.complaint.status}</span>
                  {selectedTicket.complaint.is_overdue && <span className="badge badge-rejected">Overdue</span>}
                  {selectedTicket.complaint.is_recurring && <span className="badge badge-pending">Hotspot</span>}
                  {selectedTicket.complaint.is_anonymous && (
                    <span className="badge badge-role"><EyeOff size={12} /> Anonymous</span>
                  )}
                </div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: '800', fontFamily: 'var(--font-display)' }}>
                  {selectedTicket.complaint.title}
                </h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedTicket(null)}>
                <X size={16} />
              </button>
            </div>

            {actionMsg && <div className="alert alert-success">{actionMsg}</div>}
            {actionError && <div className="alert alert-error">{actionError}</div>}

            {/* Resident & Room Meta Strip */}
            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '0.5rem',
                fontSize: '0.8rem',
              }}
            >
              <div>Resident: <b style={{ color: 'var(--text-primary)' }}>{selectedTicket.complaint.student_name}</b></div>
              <div>Hostel ID: <b style={{ color: 'var(--golden-wheat)', fontFamily: 'var(--font-mono)' }}>{selectedTicket.complaint.student_lam_id}</b></div>
              <div>Room: <b style={{ color: 'var(--text-primary)' }}>Room {selectedTicket.complaint.room_number || 'Common'} ({selectedTicket.complaint.block_name})</b></div>
              <div>Phone: <b style={{ color: 'var(--text-primary)' }}>{selectedTicket.complaint.student_phone}</b></div>
              <div>Dietary: <b style={{ color: selectedTicket.complaint.student_diet_preference === 'non_veg' ? '#f87171' : '#4ade80' }}>
                {selectedTicket.complaint.student_diet_preference === 'non_veg' ? '🍗 Non-Vegetarian' : '🌱 Vegetarian'}
              </b></div>
              <div>Allergies: <b style={{ color: selectedTicket.complaint.student_allergies && selectedTicket.complaint.student_allergies !== 'None' ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                {selectedTicket.complaint.student_allergies || 'None'}
              </b></div>
              <div>Dynamic Score: <b style={{ color: 'var(--golden-wheat)', fontFamily: 'var(--font-mono)' }}>{selectedTicket.complaint.priority_score}</b></div>
              <div>SLA Target: <b style={{ color: 'var(--text-primary)' }}>{selectedTicket.complaint.sla_hours} hours</b></div>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--soft-wheat)', lineHeight: '1.5', marginBottom: '1.25rem' }}>
              {selectedTicket.complaint.description}
            </p>

            {/* Photo Attachments */}
            {selectedTicket.images && selectedTicket.images.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  Photo Evidence ({selectedTicket.images.length})
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  {selectedTicket.images.map(img => (
                    <div key={img.id} style={{ position: 'relative', width: '110px', height: '110px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-medium)', flexShrink: 0 }}>
                      <img src={`/uploads/complaints/${img.image_url}`} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <span style={{ position: 'absolute', bottom: 2, left: 2, background: 'rgba(0,0,0,0.7)', fontSize: '0.6rem', padding: '1px 4px', borderRadius: '2px', color: '#fff', textTransform: 'uppercase' }}>
                        {img.image_type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SIMILAR COMPLAINT DETECTION & MERGE SUGGESTION (Requirement 7) */}
            {selectedTicket.similarComplaints && selectedTicket.similarComplaints.length > 0 && (
              <div
                style={{
                  background: 'rgba(163, 146, 116, 0.12)',
                  border: '1px solid var(--golden-wheat)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '800', color: 'var(--golden-wheat)', marginBottom: '0.5rem' }}>
                  <GitMerge size={16} /> SIMILAR COMPLAINT DETECTED (MERGE SUGGESTION)
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--soft-wheat)', marginBottom: '0.75rem' }}>
                  Our keyword similarity engine identified related open issues in this block. You can merge this duplicate ticket into the parent ticket:
                </p>

                {selectedTicket.similarComplaints.map(sim => (
                  <div
                    key={sim.complaint.id}
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <div>
                      <b style={{ color: 'var(--golden-wheat)', fontSize: '0.8rem' }}>#{sim.complaint.complaint_id}</b>: {sim.complaint.title}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Shared keywords: {sim.sharedKeywords.join(', ')} &bull; {Math.round(sim.similarity * 100)}% similarity match
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.7rem', padding: '0.3rem 0.65rem' }}
                      onClick={() => handleMerge(sim.complaint.id, sim.complaint.complaint_id)}
                    >
                      <GitMerge size={12} /> Merge into #{sim.complaint.complaint_id}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* STAFF AUTO-SUGGESTION DISPATCH CARD (Requirement 13a) */}
            <div
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--golden-wheat)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <UserCheck size={16} /> AUTO-SUGGESTED TECHNICIANS ({selectedTicket.complaint.category_key.toUpperCase()})
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--soft-wheat)' }}>
                  Ranked by specialisation &amp; lowest open tasks
                </span>
              </div>

              {/* Note input */}
              <input
                type="text"
                className="form-input"
                placeholder="Optional instruction note for the technician (e.g. Bring spare 16A modular socket)..."
                value={assignNote}
                onChange={e => setAssignNote(e.target.value)}
                style={{ marginBottom: '0.75rem', fontSize: '0.8rem' }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                {staffSuggestions.map(st => {
                  const isCurrent = selectedTicket.complaint.assigned_staff_id === st.id;
                  return (
                    <div
                      key={st.id}
                      style={{
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        background: isCurrent ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255,255,255,0.02)',
                        border: isCurrent ? '1px solid var(--accent-emerald)' : '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <b style={{ fontSize: '0.85rem', color: isCurrent ? 'var(--accent-emerald)' : 'var(--text-primary)' }}>
                            {st.fullName}
                          </b>
                          {st.isSpecialist && (
                            <span className="badge badge-role" style={{ fontSize: '0.6rem' }}>★ Specialist</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{st.designation || st.department}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--soft-wheat)', marginTop: '0.2rem' }}>
                          Active load: <b>{st.openTasks} open tasks</b>
                        </div>
                      </div>

                      <button
                        className={`btn btn-sm ${isCurrent ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.75rem', padding: '0.35rem' }}
                        onClick={() => handleAssignStaff(st.id, st.fullName)}
                      >
                        {isCurrent ? 'Re-assign / Update Note' : '1-Click Assign'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* STATUS UPDATE & TIMELINE */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              {/* Status Update Form */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Update Ticket Status
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <select
                    className="form-select"
                    value={statusChangeValue}
                    onChange={e => setStatusChangeValue(e.target.value)}
                  >
                    <option value="Submitted">Submitted</option>
                    <option value="Assigned">Assigned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                    <option value="Reopened">Reopened</option>
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={handleUpdateStatus}>
                    Save
                  </button>
                </div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional status transition remark..."
                  value={statusNote}
                  onChange={e => setStatusNote(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />
              </div>

              {/* Status Log Timeline */}
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', maxHeight: '180px', overflowY: 'auto' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--golden-wheat)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Status History Trail
                </div>
                {selectedTicket.timeline && selectedTicket.timeline.map(tl => (
                  <div key={tl.id} style={{ fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.35rem', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <b>{tl.to_status}</b>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                        {new Date(tl.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>{tl.notes}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
