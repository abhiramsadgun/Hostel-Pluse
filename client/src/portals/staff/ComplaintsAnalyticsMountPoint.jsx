import React from 'react';
import {
  Sparkles,
  BarChart3,
  Bot,
  Clock,
  CheckCircle2,
  Cpu,
} from 'lucide-react';

/**
 * CONTRACT COMPONENT FOR TEAMMATE (Complaints / AI Dispatch Module):
 * Dedicated dashboard view shell styled in Golden Wheat, Soft Wheat, and Deep Gray.
 */
export function ComplaintsAnalyticsMountPoint() {
  return (
    <div style={{ padding: '0 0.5rem' }}>
      {/* Teammate Integration Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(163, 146, 116, 0.16) 0%, rgba(223, 216, 200, 0.08) 100%)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'var(--grad-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
            flexShrink: 0,
          }}
        >
          <Bot size={28} color="#191918" />
        </div>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="badge badge-role">Hackathon Track Shell</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
              Dejavu Hackathon Campus Solve
            </span>
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.25rem', fontFamily: 'var(--font-display)' }}>
            Complaints &amp; AI Analytics Dashboard Shell
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', lineHeight: '1.4' }}>
            <b>Contract Integration Point:</b> Teammate building Complaints &amp; AI module can mount widgets, NLP category charts, SLA heatmaps, and technician auto-assignment tables right here in <code>ComplaintsAnalyticsMountPoint.jsx</code>.
          </p>
        </div>
      </div>

      {/* Analytics Widget Placeholder Slots */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card-contrast">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Complaints</span>
            <Sparkles size={16} color="var(--golden-wheat)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.5rem', fontFamily: 'var(--font-display)' }}>
            28
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', marginTop: '0.25rem', fontWeight: '600' }}>
            +12% this academic week
          </div>
        </div>

        <div className="stat-card-contrast">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>AI Auto-Triage Rate</span>
            <Cpu size={16} color="var(--golden-wheat)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--golden-wheat)', marginTop: '0.5rem', fontFamily: 'var(--font-display)' }}>
            94.6%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)', marginTop: '0.25rem' }}>
            Specialisation matched
          </div>
        </div>

        <div className="stat-card-contrast">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avg Resolution Time</span>
            <Clock size={16} color="var(--accent-amber)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--soft-wheat)', marginTop: '0.5rem', fontFamily: 'var(--font-display)' }}>
            2.4 hrs
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', marginTop: '0.25rem', fontWeight: '600' }}>
            Under 4-hour SLA
          </div>
        </div>

        <div className="stat-card-contrast">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Maintenance</span>
            <CheckCircle2 size={16} color="var(--accent-emerald)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--golden-wheat)', marginTop: '0.5rem', fontFamily: 'var(--font-display)' }}>
            5 Technicians
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)', marginTop: '0.25rem' }}>
            Plumbing, Electric, LAN
          </div>
        </div>
      </div>

      {/* Main Mount Panels */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="flat-card" style={{ padding: '1.5rem', minHeight: '260px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <BarChart3 size={20} color="var(--golden-wheat)" />
            <h4 style={{ fontSize: '1.05rem', fontWeight: '700', fontFamily: 'var(--font-display)' }}>
              Complaints Category Distribution (Teammate Mount Slot)
            </h4>
          </div>
          <div
            style={{
              height: '180px',
              border: '2px dashed var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--soft-wheat)',
              fontSize: '0.85rem',
              textAlign: 'center',
              padding: '1rem',
              backgroundColor: 'rgba(25, 25, 24, 0.4)',
            }}
          >
            <BarChart3 size={36} color="var(--golden-wheat)" style={{ marginBottom: '0.5rem', opacity: 0.8 }} />
            <div><b style={{ color: 'var(--text-primary)' }}>Complaints Chart Mount Slot</b></div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
              Plumbing: 38% | Electrical: 32% | Wi-Fi: 18% | Hygiene: 12%
            </div>
          </div>
        </div>

        <div className="flat-card" style={{ padding: '1.5rem', minHeight: '260px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Bot size={20} color="var(--golden-wheat)" />
            <h4 style={{ fontSize: '1.05rem', fontWeight: '700', fontFamily: 'var(--font-display)' }}>
              AI Smart Assignee Dispatch Queue (Teammate Mount Slot)
            </h4>
          </div>
          <div
            style={{
              height: '180px',
              border: '2px dashed var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--soft-wheat)',
              fontSize: '0.85rem',
              textAlign: 'center',
              padding: '1rem',
              backgroundColor: 'rgba(25, 25, 24, 0.4)',
            }}
          >
            <Bot size={36} color="var(--golden-wheat)" style={{ marginBottom: '0.5rem', opacity: 0.8 }} />
            <div><b style={{ color: 'var(--text-primary)' }}>AI Dispatch Widget Mount Slot</b></div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
              Connected to <code style={{ color: 'var(--golden-wheat)' }}>GET /api/v1/admin/maintenance/assignees</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
