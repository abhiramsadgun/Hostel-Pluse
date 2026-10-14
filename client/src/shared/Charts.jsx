import React, { useState } from 'react';

/**
 * High-Performance Vector SVG Charts for HostelPulse
 * Styled in Golden Wheat (#a39274), Soft Wheat (#dfd8c8), and Deep Gray (#252523).
 * Zero external bundle overhead, 100% interactive with tooltips and hover effects.
 */

export function BarChart({ data = [], xKey = 'name', yKey = 'value', height = 220, color = 'var(--golden-wheat)' }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No telemetry data available
      </div>
    );
  }

  const values = data.map(d => Number(d[yKey]) || 0);
  const maxVal = Math.max(...values, 1);
  const chartHeight = height - 50;

  return (
    <div style={{ position: 'relative', width: '100%', height, paddingTop: '10px' }}>
      <svg width="100%" height={chartHeight} style={{ overflow: 'visible' }}>
        {/* Horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, i) => {
          const y = chartHeight - ratio * (chartHeight - 20) - 10;
          return (
            <g key={i}>
              <line x1="0" y1={y} x2="100%" y2={y} stroke="rgba(223, 216, 200, 0.08)" strokeDasharray="3 3" />
              <text x="0" y={y - 4} fill="var(--text-muted)" fontSize="10" fontFamily="var(--font-mono)">
                {Math.round(ratio * maxVal)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((item, idx) => {
          const val = Number(item[yKey]) || 0;
          const barHeight = Math.max(4, (val / maxVal) * (chartHeight - 30));
          const colWidth = 100 / data.length;
          const barWidthPercent = Math.min(colWidth * 0.65, 8);
          const xPercent = (idx + 0.5) * colWidth;
          const y = chartHeight - barHeight - 10;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={`${xPercent - barWidthPercent / 2}%`}
                y={y}
                width={`${barWidthPercent}%`}
                height={barHeight}
                rx="4"
                fill={isHovered ? 'var(--golden-wheat-light)' : (item.color || color)}
                style={{
                  transition: 'all 0.2s ease',
                  filter: isHovered ? 'drop-shadow(0 0 8px rgba(163, 146, 116, 0.6))' : 'none',
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* X-Axis Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '6px', overflowX: 'hidden' }}>
        {data.map((item, idx) => (
          <div
            key={idx}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '0.7rem',
              color: hoveredIdx === idx ? 'var(--golden-wheat)' : 'var(--text-secondary)',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              padding: '0 2px',
              fontWeight: hoveredIdx === idx ? '700' : '500',
            }}
            title={item[xKey]}
          >
            {item[xKey]}
          </div>
        ))}
      </div>

      {/* Hover Tooltip */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div
          style={{
            position: 'absolute',
            top: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--deep-gray)',
            border: '1px solid var(--golden-wheat)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <b style={{ color: 'var(--golden-wheat)' }}>{data[hoveredIdx][xKey]}</b>: {data[hoveredIdx][yKey]}
        </div>
      )}
    </div>
  );
}

export function DonutChart({ data = [], height = 220 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No telemetry data available
      </div>
    );
  }

  const defaultColors = [
    '#a39274', // Golden wheat
    '#dfd8c8', // Soft wheat
    '#34d399', // Emerald
    '#60a5fa', // Blue
    '#f59e0b', // Amber
    '#f43f5e', // Rose
    '#a855f7', // Purple
    '#94a3b8', // Gray
  ];

  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  if (total === 0) {
    return <div style={{ height, textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>0 incidents</div>;
  }

  let cumulativeAngle = 0;
  const radius = 70;
  const strokeWidth = 26;
  const center = 100;
  const circumference = 2 * Math.PI * radius;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap', height }}>
      {/* SVG Donut */}
      <div style={{ position: 'relative', width: 200, height: 200, flexShrink: 0 }}>
        <svg width="200" height="200" viewBox="0 0 200 200">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} />
          {data.map((item, idx) => {
            const val = Number(item.value) || 0;
            const percentage = val / total;
            const strokeDasharray = `${percentage * circumference} ${circumference}`;
            const strokeDashoffset = -cumulativeAngle * circumference;
            cumulativeAngle += percentage;

            const sliceColor = item.color || defaultColors[idx % defaultColors.length];
            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={idx}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={sliceColor}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${center} ${center})`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: hoveredIdx === null || isHovered ? 1 : 0.65,
                }}
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            {hoveredIdx !== null ? data[hoveredIdx].value : total}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--golden-wheat)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {hoveredIdx !== null ? data[hoveredIdx].name : 'Total Incidents'}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxWidth: '200px' }}>
        {data.map((item, idx) => {
          const sliceColor = item.color || defaultColors[idx % defaultColors.length];
          const pct = Math.round(((Number(item.value) || 0) / total) * 100);
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.6rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '4px',
                background: isHovered ? 'rgba(163, 146, 116, 0.15)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sliceColor, flexShrink: 0 }} />
                <span style={{ color: isHovered ? 'var(--golden-wheat)' : 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {item.name}
                </span>
              </div>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
