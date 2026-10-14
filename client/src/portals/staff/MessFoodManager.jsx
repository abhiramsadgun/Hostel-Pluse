import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import {
  Utensils,
  Calendar,
  Clock,
  Download,
  CheckCircle,
  AlertCircle,
  Filter,
  Save,
  Edit2,
  RefreshCw,
  Bell,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  PieChart,
  BarChart3,
} from 'lucide-react';

export function MessFoodManager({ userRole = 'admin', wardenBlockScope = null }) {
  // Navigation tabs within food manager
  const [activeSubTab, setActiveSubTab] = useState('report'); // 'report' | 'template' | 'cutoff'

  // Count Report State
  const [reportDate, setReportDate] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().split('T')[0];
  });
  const [selectedMealType, setSelectedMealType] = useState('all');
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Template State
  const [weeklyTemplates, setWeeklyTemplates] = useState([]);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(1); // 1 = Monday
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Cutoff State
  const [cutoffConfig, setCutoffConfig] = useState({ hour: 21, minute: 0, displayTime: '09:00 PM' });
  const [newCutoffHour, setNewCutoffHour] = useState(21);
  const [newCutoffMinute, setNewCutoffMinute] = useState(0);
  const [savingCutoff, setSavingCutoff] = useState(false);
  const [cutoffMsg, setCutoffMsg] = useState(null);

  // Reminder trigger state
  const [triggeringReminder, setTriggeringReminder] = useState(false);
  const [reminderResult, setReminderResult] = useState(null);

  const DAY_NAMES = [
    { num: 1, name: 'Monday' },
    { num: 2, name: 'Tuesday' },
    { num: 3, name: 'Wednesday' },
    { num: 4, name: 'Thursday' },
    { num: 5, name: 'Friday' },
    { num: 6, name: 'Saturday' },
    { num: 7, name: 'Sunday' },
  ];

  // 1. Load initial blocks and cutoff
  useEffect(() => {
    async function init() {
      try {
        const bRes = await api.get('/admin/blocks');
        if (bRes.success) {
          setBlocks(bRes.data || []);
        }
      } catch (err) {
        // non-blocking
      }

      try {
        const cRes = await api.get('/food/cutoff');
        if (cRes.success) {
          setCutoffConfig(cRes.data);
          setNewCutoffHour(cRes.data.hour ?? 21);
          setNewCutoffMinute(cRes.data.minute ?? 0);
        }
      } catch (err) {
        // non-blocking
      }
    }
    init();
  }, []);

  // 2. Load Count Report
  async function loadReport() {
    setLoadingReport(true);
    setReportError(null);
    try {
      let url = `/food/report?date=${reportDate}`;
      if (selectedMealType && selectedMealType !== 'all') {
        url += `&mealType=${selectedMealType}`;
      }
      if (selectedBlockId) {
        url += `&blockId=${selectedBlockId}`;
      }
      const res = await api.get(url);
      if (res.success) {
        setReportData(res.data);
      } else {
        setReportError(res.error?.message || 'Failed to generate report.');
      }
    } catch (err) {
      setReportError(err.message || 'Report fetch failure.');
    } finally {
      setLoadingReport(false);
    }
  }

  useEffect(() => {
    if (activeSubTab === 'report') {
      loadReport();
    }
  }, [reportDate, selectedMealType, selectedBlockId, activeSubTab]);

  // 3. Load Template
  async function loadTemplates() {
    setLoadingTemplates(true);
    setTemplateError(null);
    try {
      const res = await api.get(`/food/template?dayOfWeek=${selectedDayOfWeek}`);
      if (res.success) {
        setWeeklyTemplates(res.data.templates || []);
      }
    } catch (err) {
      setTemplateError(err.message || 'Failed to load templates.');
    } finally {
      setLoadingTemplates(false);
    }
  }

  useEffect(() => {
    if (activeSubTab === 'template') {
      loadTemplates();
    }
  }, [selectedDayOfWeek, activeSubTab]);

  // 4. Handle CSV Export
  function handleExportCSV() {
    let url = `${api.baseURL}/food/report/export?date=${reportDate}`;
    if (selectedMealType && selectedMealType !== 'all') {
      url += `&mealType=${selectedMealType}`;
    }
    if (selectedBlockId) {
      url += `&blockId=${selectedBlockId}`;
    }

    // Direct browser download
    const token = localStorage.getItem('token');
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.blob())
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `HostelPulse-Kitchen-Report-${reportDate}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(err => {
        alert('CSV Export failed: ' + err.message);
      });
  }

  // 5. Handle Template Update
  async function handleSaveTemplate(e) {
    e.preventDefault();
    if (!editingTemplate) return;
    setSavingTemplate(true);
    try {
      const res = await api.put(`/food/template/${editingTemplate.id}`, {
        mealTime: editingTemplate.meal_time,
        vegItems: editingTemplate.veg_items,
        nonvegItems: editingTemplate.nonveg_items || '',
        nonvegAvailable: editingTemplate.nonveg_available,
      });
      if (res.success) {
        setEditingTemplate(null);
        loadTemplates();
      } else {
        alert(res.error?.message || 'Failed to save template.');
      }
    } catch (err) {
      alert('Error updating template: ' + err.message);
    } finally {
      setSavingTemplate(false);
    }
  }

  // 6. Handle Cutoff Time Update
  async function handleSaveCutoff(e) {
    e.preventDefault();
    setSavingCutoff(true);
    setCutoffMsg(null);
    try {
      const res = await api.put('/food/cutoff', {
        hour: parseInt(newCutoffHour, 10),
        minute: parseInt(newCutoffMinute, 10),
      });
      if (res.success) {
        setCutoffConfig(res.data.cutoffConfig);
        setCutoffMsg(res.data.message);
      }
    } catch (err) {
      alert('Failed to update cutoff: ' + err.message);
    } finally {
      setSavingCutoff(false);
    }
  }

  // 7. Trigger 8 PM Reminder Now
  async function handleTriggerReminder() {
    setTriggeringReminder(true);
    setReminderResult(null);
    try {
      const res = await api.post('/food/reminder/trigger', {});
      if (res.success) {
        setReminderResult(res.data);
      }
    } catch (err) {
      alert('Failed to trigger reminder: ' + err.message);
    } finally {
      setTriggeringReminder(false);
    }
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Subtab Navigation Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.75rem',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border-medium)',
          paddingBottom: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <span className="badge badge-role" style={{ fontSize: '0.75rem' }}>
              Mess & Kitchen Operations
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--soft-wheat)' }}>
              Lock Cutoff: <b>{cutoffConfig.displayTime || '09:00 PM IST'}</b>
            </span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
            Hostel Dining & Meal Count Intelligence
          </h1>
        </div>

        {/* Action Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-surface)', padding: '0.35rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <button
            className={`btn btn-sm ${activeSubTab === 'report' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('report')}
          >
            <BarChart3 size={15} /> Kitchen Count Report
          </button>
          <button
            className={`btn btn-sm ${activeSubTab === 'template' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('template')}
          >
            <Calendar size={15} /> Weekly Menu Template (Mon-Sun)
          </button>
          {['admin', 'mess'].includes(userRole) && (
            <button
              className={`btn btn-sm ${activeSubTab === 'cutoff' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveSubTab('cutoff')}
            >
              <Clock size={15} /> Cut-Off Settings
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 1. KITCHEN COUNT REPORT VIEW                                          */}
      {/* ===================================================================== */}
      {activeSubTab === 'report' && (
        <div>
          {/* Filter Bar */}
          <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {/* Date Picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={18} color="var(--golden-wheat)" />
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--soft-wheat)' }}>Meal Date:</label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ padding: '0.4rem 0.75rem', width: 'auto', background: 'var(--bg-input)' }}
                    value={reportDate}
                    onChange={e => setReportDate(e.target.value)}
                  />
                </div>

                {/* Meal Type Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Filter size={18} color="var(--golden-wheat)" />
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--soft-wheat)' }}>Meal:</label>
                  <select
                    className="form-select"
                    style={{ padding: '0.4rem 0.75rem', width: 'auto', background: 'var(--bg-input)' }}
                    value={selectedMealType}
                    onChange={e => setSelectedMealType(e.target.value)}
                  >
                    <option value="all">All Meals</option>
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="snacks">Snacks</option>
                    <option value="dinner">Dinner</option>
                  </select>
                </div>

                {/* Block Filter (Disabled for Warden who is scoped) */}
                {!wardenBlockScope && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--soft-wheat)' }}>Block:</label>
                    <select
                      className="form-select"
                      style={{ padding: '0.4rem 0.75rem', width: 'auto', background: 'var(--bg-input)' }}
                      value={selectedBlockId}
                      onChange={e => setSelectedBlockId(e.target.value)}
                    >
                      <option value="">All Hostel Blocks</option>
                      {blocks.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Action Buttons: Export CSV & Refresh */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={loadReport}
                  disabled={loadingReport}
                  title="Refresh Report Data"
                >
                  <RefreshCw size={15} className={loadingReport ? 'spin' : ''} /> Refresh
                </button>

                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleExportCSV}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Download size={15} /> Export CSV Report
                </button>
              </div>
            </div>
          </div>

          {reportError && <div className="alert alert-error">{reportError}</div>}

          {/* KPI Summary Cards */}
          {reportData && (
            <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
              <div className="stat-card">
                <div className="stat-label">Total Registered Students</div>
                <div className="stat-value" style={{ color: 'var(--soft-wheat)' }}>
                  {reportData.totalEligibleStudents}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Active students in scope
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Approved Outpasses (Excluded)</div>
                <div className="stat-value" style={{ color: 'var(--accent-amber)' }}>
                  {reportData.outpassExcludedCount}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Excluded via getStudentsOut hook
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Total Expected Diners</div>
                <div className="stat-value" style={{ color: 'var(--golden-wheat)' }}>
                  {reportData.expectedEaters}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Net headcount preparing meals for
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Report Day & Date</div>
                <div className="stat-value" style={{ fontSize: '1.35rem', color: 'var(--text-primary)' }}>
                  {reportData.dayName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', marginTop: '0.35rem' }}>
                  {reportData.date}
                </div>
              </div>
            </div>
          )}

          {/* Interactive Bar Chart: Veg vs Non-Veg Breakdown */}
          {reportData?.meals && reportData.meals.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                    Meal Preparation Distribution: Veg vs Non-Veg
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--soft-wheat)', margin: '0.2rem 0 0' }}>
                    Visual counts based on explicit student confirmations and default profile preferences
                  </p>
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: 'var(--accent-emerald)' }}></div>
                    <span style={{ color: 'var(--soft-wheat)', fontWeight: '600' }}>Vegetarian (Veg)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: 'var(--golden-wheat)' }}></div>
                    <span style={{ color: 'var(--soft-wheat)', fontWeight: '600' }}>Non-Vegetarian (Non-Veg)</span>
                  </div>
                </div>
              </div>

              {/* Responsive SVG Bar Chart */}
              <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
                <div style={{ minWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {reportData.meals.map(m => {
                    const total = m.vegCount + m.nonvegCount;
                    const vegPercent = total > 0 ? Math.round((m.vegCount / total) * 100) : 100;
                    const nonvegPercent = total > 0 ? Math.round((m.nonvegCount / total) * 100) : 0;

                    return (
                      <div key={m.mealType} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span className="badge badge-role" style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                              {m.mealType}
                            </span>
                            <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                              {m.mealTime}
                            </span>
                            {m.nonvegAvailable ? (
                              <span style={{ fontSize: '0.7rem', color: 'var(--golden-wheat)', background: 'rgba(163, 146, 116, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                                Non-Veg Served Today
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                Pure Veg Meal
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--accent-emerald)', fontWeight: '700' }}>
                              🌱 Veg: {m.vegCount} ({vegPercent}%)
                            </span>
                            {m.nonvegAvailable && (
                              <span style={{ color: 'var(--golden-wheat)', fontWeight: '700' }}>
                                🍗 Non-Veg: {m.nonvegCount} ({nonvegPercent}%)
                              </span>
                            )}
                            <span style={{ color: 'var(--soft-wheat)' }}>
                              Total: <b>{total}</b>
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar Visualizer */}
                        <div
                          style={{
                            height: '24px',
                            background: 'rgba(0, 0, 0, 0.3)',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            display: 'flex',
                            position: 'relative',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div
                            style={{
                              width: `${vegPercent}%`,
                              background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                              transition: 'width 0.4s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              color: '#fff',
                            }}
                            title={`Vegetarian: ${m.vegCount} students`}
                          >
                            {vegPercent > 12 && `${m.vegCount} Veg`}
                          </div>

                          {m.nonvegAvailable && nonvegPercent > 0 && (
                            <div
                              style={{
                                width: `${nonvegPercent}%`,
                                background: 'linear-gradient(90deg, #a39274 0%, #c4b59d 100%)',
                                transition: 'width 0.4s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: '800',
                                color: '#191918',
                              }}
                              title={`Non-Vegetarian: ${m.nonvegCount} students`}
                            >
                              {nonvegPercent > 12 && `${m.nonvegCount} Non-Veg`}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Detailed Meal & Block Breakdown Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {reportData?.meals?.map(m => (
              <div key={m.mealType} className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-medium)', paddingBottom: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span className="badge badge-role" style={{ textTransform: 'uppercase', fontSize: '0.85rem' }}>
                        {m.mealType}
                      </span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--soft-wheat)', fontWeight: '600' }}>
                        Timing: {m.mealTime}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <b>Veg Items:</b> {m.vegItems}
                    </div>
                    {m.nonvegAvailable && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--golden-wheat)', marginTop: '0.2rem' }}>
                        <b>Non-Veg Special:</b> {m.nonvegItems}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Veg Preparation</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-emerald)' }}>
                        {m.vegCount}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Non-Veg Preparation</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '800', color: m.nonvegAvailable ? 'var(--golden-wheat)' : 'var(--text-muted)' }}>
                        {m.nonvegCount}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1.25rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Diners</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                        {m.expectedEaters}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Block Breakdown Table */}
                <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--golden-wheat)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Headcount Breakdown by Hostel Block
                </h4>

                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ margin: 0, fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Hostel Block</th>
                        <th>Code</th>
                        <th>Gender</th>
                        <th style={{ textAlign: 'right' }}>Total In Block</th>
                        <th style={{ textAlign: 'right' }}>Veg Count</th>
                        <th style={{ textAlign: 'right' }}>Non-Veg Count</th>
                        <th style={{ textAlign: 'right' }}>% Non-Veg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.byBlock?.length > 0 ? (
                        m.byBlock.map(b => {
                          const nonvegRate = b.totalStudents > 0 ? Math.round((b.nonvegCount / b.totalStudents) * 100) : 0;
                          return (
                            <tr key={b.blockId}>
                              <td><b>{b.blockName}</b></td>
                              <td><span className="badge badge-approved" style={{ fontSize: '0.7rem' }}>{b.blockCode}</span></td>
                              <td style={{ textTransform: 'capitalize' }}>{b.gender}</td>
                              <td style={{ textAlign: 'right', fontWeight: '700' }}>{b.totalStudents}</td>
                              <td style={{ textAlign: 'right', color: 'var(--accent-emerald)', fontWeight: '700' }}>{b.vegCount}</td>
                              <td style={{ textAlign: 'right', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                                {m.nonvegAvailable ? b.nonvegCount : '-'}
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                {m.nonvegAvailable ? `${nonvegRate}%` : '0%'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            No active students found in this block filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Quick 8 PM Reminder Notification Trigger Card (for Testing & Manual Operations) */}
          <div className="glass-panel" style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(163, 146, 116, 0.05)', border: '1px solid var(--border-medium)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--golden-wheat)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Bell size={18} /> Daily 8:00 PM Student Reminder Job
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', margin: '0.35rem 0 0' }}>
                  The server automatically runs this node-cron job every night at 8:00 PM IST to notify students who haven't confirmed tomorrow's meal choices.
                </p>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={handleTriggerReminder}
                disabled={triggeringReminder}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Bell size={14} /> {triggeringReminder ? 'Dispatching Notifications...' : 'Trigger 8:00 PM Reminder Now'}
              </button>
            </div>

            {reminderResult && (
              <div className="alert alert-success" style={{ marginTop: '1rem', marginBottom: 0 }}>
                Dispatched reminders to {reminderResult.sentCount} unconfirmed students for tomorrow ({reminderResult.tomorrowStr}).
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. WEEKLY MENU TEMPLATE EDITOR (Monday to Sunday)                     */}
      {/* ===================================================================== */}
      {activeSubTab === 'template' && (
        <div>
          <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                  South Indian Weekly Menu Template
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--soft-wheat)', margin: '0.2rem 0 0' }}>
                  Stored once as a recurring weekly rotation (Monday to Sunday). Each day's menu derives automatically from the weekday.
                </p>
              </div>

              {/* Day Selector Pills */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {DAY_NAMES.map(d => (
                  <button
                    key={d.num}
                    className={`btn btn-sm ${selectedDayOfWeek === d.num ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSelectedDayOfWeek(d.num)}
                    style={{ minWidth: '85px' }}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {templateError && <div className="alert alert-error">{templateError}</div>}

          {/* Day's Meals Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {weeklyTemplates.map(item => (
              <div key={item.id} className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                      <span className="badge badge-role" style={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>
                        {item.meal_type}
                      </span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                        <Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                        {item.meal_time}
                      </span>
                      {item.nonveg_available ? (
                        <span className="badge badge-pending" style={{ fontSize: '0.75rem' }}>
                          🍗 Non-Veg Available
                        </span>
                      ) : (
                        <span className="badge badge-approved" style={{ fontSize: '0.75rem' }}>
                          🌱 Pure Vegetarian
                        </span>
                      )}
                    </div>

                    <div style={{ marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
                        Vegetarian Menu:
                      </span>
                      <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0.2rem 0 0', lineHeight: 1.4 }}>
                        {item.veg_items}
                      </p>
                    </div>

                    {item.nonveg_available && (
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--golden-wheat)', textTransform: 'uppercase' }}>
                          Non-Vegetarian Special:
                        </span>
                        <p style={{ fontSize: '0.95rem', color: 'var(--soft-wheat)', margin: '0.2rem 0 0', lineHeight: 1.4 }}>
                          {item.nonveg_items || 'None configured'}
                        </p>
                      </div>
                    )}
                  </div>

                  {['admin', 'mess'].includes(userRole) && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingTemplate(item)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Edit2 size={14} /> Edit Meal & Timing
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. CUT-OFF TIME SETTING VIEW                                          */}
      {/* ===================================================================== */}
      {activeSubTab === 'cutoff' && (
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Daily Preference Cut-Off Configuration
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Students can confirm or toggle between Veg and Non-Veg for the next day up until this strict cut-off time.
              After this deadline, the choice is locked, the server rejects updates, and the student's profile default is used for non-respondents.
            </p>

            {cutoffMsg && <div className="alert alert-success">{cutoffMsg}</div>}

            <form onSubmit={handleSaveCutoff}>
              <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Cut-Off Hour (24h IST) *</label>
                  <select
                    className="form-select"
                    value={newCutoffHour}
                    onChange={e => setNewCutoffHour(e.target.value)}
                  >
                    {Array.from({ length: 24 }).map((_, i) => {
                      const hour12 = i % 12 || 12;
                      const ampm = i >= 12 ? 'PM' : 'AM';
                      return (
                        <option key={i} value={i}>
                          {String(i).padStart(2, '0')}:00 ({hour12}:00 {ampm})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Cut-Off Minute *</label>
                  <select
                    className="form-select"
                    value={newCutoffMinute}
                    onChange={e => setNewCutoffMinute(e.target.value)}
                  >
                    <option value="0">00 (Top of the hour)</option>
                    <option value="15">15 mins</option>
                    <option value="30">30 mins</option>
                    <option value="45">45 mins</option>
                  </select>
                </div>
              </div>

              <div style={{ background: 'rgba(163, 146, 116, 0.1)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)' }}>
                  Current active locking deadline: <b style={{ color: 'var(--golden-wheat)' }}>{cutoffConfig.displayTime || '09:00 PM IST'}</b>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Timezone: Asia/Kolkata (Indian Standard Time)
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.85rem' }}
                disabled={savingCutoff}
              >
                <Save size={16} /> {savingCutoff ? 'Updating Cut-Off...' : 'Save Cut-Off Configuration'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {editingTemplate && (
        <div className="modal-backdrop" onClick={() => setEditingTemplate(null)}>
          <div className="modal-card" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                  Edit {editingTemplate.day_name} {editingTemplate.meal_type.toUpperCase()}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)' }}>
                  Updates recurring weekly template
                </span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingTemplate(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Meal Service Timing *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingTemplate.meal_time}
                  onChange={e => setEditingTemplate({ ...editingTemplate, meal_time: e.target.value })}
                  placeholder="e.g. 07:30 - 09:00"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Vegetarian Menu Dishes (Veg) *</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={editingTemplate.veg_items}
                  onChange={e => setEditingTemplate({ ...editingTemplate, veg_items: e.target.value })}
                  placeholder="e.g. Steamed Idli (3 pcs), Medu Vada, Drumstick Sambar & Coconut Chutney"
                  required
                />
              </div>

              {/* Non-Veg Availability Toggle */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingTemplate.nonveg_available}
                    onChange={e => setEditingTemplate({ ...editingTemplate, nonveg_available: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--golden-wheat)' }}
                  />
                  <span>Serve Non-Vegetarian Option on this meal</span>
                </label>
              </div>

              {editingTemplate.nonveg_available && (
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Non-Vegetarian Special Item *</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={editingTemplate.nonveg_items || ''}
                    onChange={e => setEditingTemplate({ ...editingTemplate, nonveg_items: e.target.value })}
                    placeholder="e.g. Chettinad Spicy Chicken Curry / Boiled Egg"
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingTemplate(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingTemplate}
                >
                  <Save size={16} /> {savingTemplate ? 'Saving Changes...' : 'Save Template Meal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
