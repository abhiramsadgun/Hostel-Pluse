import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import { BarChart, DonutChart } from '../../shared/Charts';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building,
  RefreshCw,
  Search,
  Zap,
} from 'lucide-react';

export function AdminReportsView() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (startDate) q.append('startDate', startDate);
      if (endDate) q.append('endDate', endDate);
      if (categoryFilter !== 'all') q.append('categoryKey', categoryFilter);
      if (statusFilter !== 'all') q.append('status', statusFilter);

      const res = await api.get(`/reports/summary?${q.toString()}`);
      if (res.success) {
        setReportData(res.data);
      }
    } catch (err) {
      setError('Failed to generate report: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, [startDate, endDate, categoryFilter, statusFilter]);

  // Download CSV
  function handleDownloadCsv() {
    const q = new URLSearchParams();
    if (startDate) q.append('startDate', startDate);
    if (endDate) q.append('endDate', endDate);
    if (categoryFilter !== 'all') q.append('categoryKey', categoryFilter);

    const token = localStorage.getItem('hostelpulse_token');
    window.open(`/api/v1/reports/export-csv?${q.toString()}`, '_blank');
  }

  // Trigger Print / PDF
  function handlePrintPdf() {
    window.print();
  }

  const summary = reportData?.summary || {};

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Top Action Bar */}
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
            <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Campus Operations Audit</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>DEJAVU HACKATHON DELIVERABLE</span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-display)' }}>
            Operations &amp; Complaints Official Report
          </h2>
          <p style={{ color: 'var(--soft-wheat)', fontSize: '0.85rem' }}>
            Comprehensive institutional audit trail with date-range filters, SLA breaches, recurring hotspots, and export.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={handlePrintPdf} title="Print or Save as PDF">
            <Printer size={16} /> Print / PDF
          </button>
          <button className="btn btn-primary" onClick={handleDownloadCsv} style={{ fontWeight: '700' }}>
            <Download size={16} /> Export to CSV
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={16} color="var(--golden-wheat)" />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>From:</span>
            <input
              type="date"
              className="form-input"
              style={{ width: '150px', padding: '0.4rem' }}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>To:</span>
            <input
              type="date"
              className="form-input"
              style={{ width: '150px', padding: '0.4rem' }}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>

          <select
            className="form-select"
            style={{ width: 'auto' }}
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
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

          <select
            className="form-select"
            style={{ width: 'auto' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>

          <button className="btn btn-secondary btn-sm" onClick={loadReport} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Apply Filters
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* KPI Summary Strip */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card-contrast">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Lodged</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--golden-wheat)', fontFamily: 'var(--font-display)' }}>
            {summary.totalComplaints || 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--soft-wheat)' }}>In Selected Date Range</div>
        </div>

        <div className="stat-card-contrast">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Resolved Turnaround</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--accent-emerald)', fontFamily: 'var(--font-display)' }}>
            {summary.resolvedCount || 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)' }}>
            {summary.totalComplaints ? Math.round(((summary.resolvedCount || 0) / summary.totalComplaints) * 100) : 0}% Resolution Rate
          </div>
        </div>

        <div className="stat-card-contrast">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overdue SLA Breaches</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: (summary.overdueCount || 0) > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', fontFamily: 'var(--font-display)' }}>
            {summary.overdueCount || 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--soft-wheat)' }}>Exceeded Target Time</div>
        </div>

        <div className="stat-card-contrast">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Turnaround Time</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--soft-wheat)', fontFamily: 'var(--font-display)' }}>
            {summary.avgResolutionHours || 0}h
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--golden-wheat)' }}>From Lodging to Fix</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="flat-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>
            Complaints by Category Distribution
          </h3>
          <BarChart
            data={(reportData?.categoryBreakdown || []).map(cb => ({
              name: cb.category_key,
              value: parseInt(cb.count, 10),
            }))}
            xKey="name"
            yKey="value"
            height={220}
          />
        </div>

        <div className="flat-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>
            Active Recurring Hotspots (3+ Incidents)
          </h3>
          {reportData?.recurringHotspots && reportData.recurringHotspots.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {reportData.recurringHotspots.slice(0, 5).map(h => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <b style={{ color: 'var(--golden-wheat)', textTransform: 'capitalize' }}>{h.category_key}</b>: {h.room_number ? `Room ${h.room_number}` : 'Common Area'} &bull; <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{h.block_name}</span>
                  </div>
                  <span className="badge badge-pending">{h.occurrence_count} occurrences</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No recurring hotspots detected in this period.
            </div>
          )}
        </div>
      </div>

      {/* Overdue Tickets Table */}
      {reportData?.overdueList && reportData.overdueList.length > 0 && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--accent-rose)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <AlertTriangle size={18} color="var(--accent-rose)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-rose)' }}>
              Overdue Incidents Breaching SLA ({reportData.overdueList.length})
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.5rem' }}>ID</th>
                  <th style={{ padding: '0.5rem' }}>Title</th>
                  <th style={{ padding: '0.5rem' }}>Category</th>
                  <th style={{ padding: '0.5rem' }}>Location</th>
                  <th style={{ padding: '0.5rem' }}>Reported Date</th>
                  <th style={{ padding: '0.5rem' }}>SLA Target</th>
                  <th style={{ padding: '0.5rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.overdueList.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--golden-wheat)' }}>{o.complaint_id}</td>
                    <td style={{ padding: '0.6rem 0.5rem', fontWeight: '600' }}>{o.title}</td>
                    <td style={{ padding: '0.6rem 0.5rem', textTransform: 'capitalize' }}>{o.category_key}</td>
                    <td style={{ padding: '0.6rem 0.5rem' }}>{o.room_number ? `Room ${o.room_number}` : 'Common Area'} ({o.block_name})</td>
                    <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '0.6rem 0.5rem', color: 'var(--accent-rose)', fontWeight: '700' }}>{o.sla_hours}h SLA</td>
                    <td style={{ padding: '0.6rem 0.5rem' }}><span className="badge badge-rejected">{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Complaints Table */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem' }}>
          Detailed Incident Audit Trail ({reportData?.complaints?.length || 0} Records)
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)' }}>
                <th style={{ padding: '0.6rem' }}>ID</th>
                <th style={{ padding: '0.6rem' }}>Title</th>
                <th style={{ padding: '0.6rem' }}>Category</th>
                <th style={{ padding: '0.6rem' }}>Block / Room</th>
                <th style={{ padding: '0.6rem' }}>Lodged By</th>
                <th style={{ padding: '0.6rem' }}>Created At</th>
                <th style={{ padding: '0.6rem' }}>Status</th>
                <th style={{ padding: '0.6rem' }}>Technician</th>
                <th style={{ padding: '0.6rem' }}>Rating</th>
              </tr>
            </thead>
            <tbody>
              {reportData?.complaints?.slice(0, 30).map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '0.6rem', fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--golden-wheat)' }}>{c.complaint_id}</td>
                  <td style={{ padding: '0.6rem', fontWeight: '600', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</td>
                  <td style={{ padding: '0.6rem', textTransform: 'capitalize' }}>{c.category_key}</td>
                  <td style={{ padding: '0.6rem' }}>{c.room_number ? `Rm ${c.room_number}` : 'Common'} ({c.block_name})</td>
                  <td style={{ padding: '0.6rem' }}>{c.student_name}</td>
                  <td style={{ padding: '0.6rem', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '0.6rem' }}>
                    <span className={`badge ${c.status === 'Resolved' || c.status === 'Closed' ? 'badge-approved' : 'badge-pending'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem', color: c.assigned_staff_name ? 'var(--golden-wheat)' : 'var(--text-muted)' }}>
                    {c.assigned_staff_name || 'Unassigned'}
                  </td>
                  <td style={{ padding: '0.6rem', color: 'var(--accent-amber)', fontWeight: '700' }}>
                    {c.feedback_rating ? `★ ${c.feedback_rating}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
