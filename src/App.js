import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL;

// ── SVG Icons ────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const Icons = {
  upload:   "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  pdf:      ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M16 13H8M16 17H8M10 9H8"],
  compare:  "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  x:        "M18 6L6 18M6 6l12 12",
  shield:   ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
  lock:     ["M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z", "M7 11V7a5 5 0 0 1 10 0v4"],
  cpu:      "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8 12h8M12 8v8",
  zap:      "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  eye_off:  ["M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94", "M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19", "M1 1l22 22"],
  page:     ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"],
  info:     ["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z", "M12 8h.01M12 12v4"],
  ocr:      "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2",
  math:     "M4 6h16M4 12h16M4 18h7",
};

// ── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = ({ size = 18, color = '#3b82f6' }) => (
  <div style={{
    width: size, height: size,
    border: `2px solid rgba(255,255,255,0.1)`,
    borderTopColor: color,
    borderRadius: '50%',
    animation: 'ar-spin 0.75s linear infinite',
    flexShrink: 0,
  }} />
);

// ── DropZone ─────────────────────────────────────────────────────────────────
const DropZone = ({ label, sublabel, badge, file, fileName, onFile, onClear, accent }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') onFile(f);
  }, [onFile]);

  const palette = {
    blue: { a: '#3b82f6', glow: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.4)',  tag: 'rgba(59,130,246,0.12)' },
    teal: { a: '#14b8a6', glow: 'rgba(20,184,166,0.1)',  border: 'rgba(20,184,166,0.4)',  tag: 'rgba(20,184,166,0.12)' },
  };
  const c = palette[accent] || palette.blue;

  return (
    <div style={{ flex: 1, minWidth: '240px' }}>
      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{
          padding: '2px 8px', borderRadius: '5px',
          background: c.tag, color: c.a,
          fontSize: '9px', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>{badge}</span>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>{sublabel}</span>
      </div>

      {/* Drop area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${(dragging || file) ? c.border : 'rgba(255,255,255,0.07)'}`,
          borderRadius: '14px',
          padding: file ? '18px 20px' : '36px 20px',
          cursor: file ? 'default' : 'pointer',
          background: dragging ? c.glow : file ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.015)',
          transition: 'all 0.2s ease',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '10px',
          minHeight: file ? 'auto' : '155px',
        }}
      >
        <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files[0]; if (f) onFile(f); e.target.value = ''; }} />

        {file ? (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '9px', flexShrink: 0,
              background: c.tag, color: c.a,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon d={Icons.pdf} size={17} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fileName}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{(file.size / 1024).toFixed(1)} KB · PDF</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '7px', padding: '5px 7px', cursor: 'pointer', color: '#f87171',
                display: 'flex', alignItems: 'center', flexShrink: 0,
              }}
            ><Icon d={Icons.x} size={13} /></button>
          </div>
        ) : (
          <>
            <div style={{
              width: '42px', height: '42px', borderRadius: '11px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8',
            }}>
              <Icon d={Icons.upload} size={19} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#cbd5e1' }}>
                Drop PDF here or <span style={{ color: c.a, fontWeight: '600' }}>browse</span>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>PDF files only</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Privacy Pill ──────────────────────────────────────────────────────────────
const PrivacyPill = ({ icon, text }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '5px 11px', borderRadius: '20px',
    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
    fontSize: '11px', fontWeight: '500', color: '#94a3b8',
    whiteSpace: 'nowrap',
  }}>
    <span style={{ color: '#14b8a6', display: 'flex' }}><Icon d={icon} size={12} /></span>
    {text}
  </div>
);

// ── Type Badge ────────────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => {
  const m = {
    modified: { label: 'Modified', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
    added:    { label: 'Added',    color: '#10b981', bg: 'rgba(16,185,129,0.1)'   },
    removed:  { label: 'Removed',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)'    },
  };
  const t = m[type] || m.modified;
  return <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '5px', background: t.bg, color: t.color, fontSize: '9px', fontWeight: '800', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{t.label}</span>;
};

// ── Confidence Indicator ──────────────────────────────────────────────────────
const ConfidenceDot = ({ level }) => {
  const colors = { high: '#10b981', medium: '#f59e0b', low: '#ef4444' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#94a3b8' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors[level] || '#475569', display: 'inline-block', flexShrink: 0 }} />
      {level || 'N/A'}
    </span>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ value, label, color, bg, border }) => (
  <div style={{ flex: 1, minWidth: '105px', background: bg, border: `1px solid ${border}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
    <div style={{ fontFamily: '"Syne", sans-serif', fontSize: '2rem', fontWeight: '800', color, lineHeight: 1 }}>{value ?? '—'}</div>
    <div style={{ fontSize: '9px', fontWeight: '700', color: '#94a3b8', marginTop: '6px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
  </div>
);

// ── Inline Token Diff ─────────────────────────────────────────────────────────
// Splits pipe-separated strings into tokens and highlights only the changed ones.
const parsePipe = (str) =>
  (str || '').split('|').map(t => t.trim());

const InlineDiff = ({ oldVal, newVal, type }) => {
  // For added/removed rows just show plain value
  if (type === 'added') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
        {parsePipe(newVal).filter(t => t !== '').map((t, i) => (
          <span key={i} style={{
            padding: '1px 6px', borderRadius: '4px',
            background: 'rgba(16,185,129,0.12)', color: '#6ee7b7',
            fontFamily: 'monospace', fontSize: '12px',
          }}>{t}</span>
        ))}
      </div>
    );
  }
  if (type === 'removed') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
        {parsePipe(oldVal).filter(t => t !== '').map((t, i) => (
          <span key={i} style={{
            padding: '1px 6px', borderRadius: '4px',
            background: 'rgba(239,68,68,0.12)', color: '#fca5a5',
            fontFamily: 'monospace', fontSize: '12px',
            textDecoration: 'line-through',
          }}>{t}</span>
        ))}
      </div>
    );
  }

  // Modified: compare token by token
  const oldTokens = parsePipe(oldVal);
  const newTokens = parsePipe(newVal);
  const len = Math.max(oldTokens.length, newTokens.length);

  const oldCells = [];
  const newCells = [];
  let hasDiff = false;

  for (let i = 0; i < len; i++) {
    const o = (oldTokens[i] || '').trim();
    const n = (newTokens[i] || '').trim();
    const changed = o !== n;
    if (changed) hasDiff = true;

    if (o !== '') {
      oldCells.push(
        <span key={i} style={{
          padding: '2px 7px', borderRadius: '4px',
          background: changed ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
          color: changed ? '#fca5a5' : '#e2e8f0',
          fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6',
          textDecoration: 'none',
          fontWeight: changed ? '600' : '400',
          border: changed ? '1px solid rgba(239,68,68,0.25)' : '1px solid transparent',
        }}>{o}</span>
      );
    }

    if (n !== '') {
      newCells.push(
        <span key={i} style={{
          padding: '2px 7px', borderRadius: '4px',
          background: changed ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
          color: changed ? '#6ee7b7' : '#e2e8f0',
          fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6',
          fontWeight: changed ? '600' : '400',
          border: changed ? '1px solid rgba(16,185,129,0.25)' : '1px solid transparent',
        }}>{n}</span>
      );
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Old row */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center',
        padding: '6px 8px', borderRadius: '7px',
        background: hasDiff ? 'rgba(239,68,68,0.05)' : 'transparent',
        border: hasDiff ? '1px solid rgba(239,68,68,0.12)' : '1px solid transparent',
      }}>
        <span style={{ fontSize: '9px', fontWeight: '700', color: '#ef4444', letterSpacing: '0.07em', marginRight: '4px', textTransform: 'uppercase', flexShrink: 0, opacity: 0.6 }}>OLD</span>
        {oldCells}
      </div>
      {/* New row */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center',
        padding: '6px 8px', borderRadius: '7px',
        background: hasDiff ? 'rgba(16,185,129,0.05)' : 'transparent',
        border: hasDiff ? '1px solid rgba(16,185,129,0.12)' : '1px solid transparent',
      }}>
        <span style={{ fontSize: '9px', fontWeight: '700', color: '#10b981', letterSpacing: '0.07em', marginRight: '4px', textTransform: 'uppercase', flexShrink: 0, opacity: 0.6 }}>NEW</span>
        {newCells}
      </div>
    </div>
  );
};

// ── Feature Card ──────────────────────────────────────────────────────────────
const FeatureCard = ({ icon, title, desc }) => (
  <div
    style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', transition: 'border-color 0.2s' }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
  >
    <div style={{ color: '#3b82f6', marginBottom: '10px', display: 'flex' }}><Icon d={icon} size={18} /></div>
    <div style={{ fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>{title}</div>
    <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.7 }}>{desc}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]             = useState('home'); // 'home'|'about'|'privacy'|'support'
  const [oldPdf, setOldPdf]         = useState(null);
  const [newPdf, setNewPdf]         = useState(null);
  const [oldPdfName, setOldPdfName] = useState('');
  const [newPdfName, setNewPdfName] = useState('');
  const [summary, setSummary]       = useState(null);
  const [compResult, setCompResult] = useState(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState('');
  const [filter, setFilter]         = useState('all');

  const handleFile = (file, type) => {
    setError('');
    if (type === 'old') { setOldPdf(file); setOldPdfName(file.name); }
    else                { setNewPdf(file); setNewPdfName(file.name); }
  };

  const handleCompare = async () => {
    if (!oldPdf || !newPdf) { setError('Please upload both PDF versions to continue.'); return; }
    setIsLoading(true); setError(''); setSummary(null); setCompResult(null);
    const fd = new FormData();
    fd.append('old_file', oldPdf);
    fd.append('new_file', newPdf);
    try {
      const res = await fetch(`${API_URL}/compare`, { method: 'POST', body: fd });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Server error.'); }
      const data = await res.json();
      setSummary(data.summary);
      const grouped = (data.differences?.rate_tables || []).reduce((acc, c) => {
        if (!acc[c.location]) acc[c.location] = [];
        acc[c.location].push(c);
        return acc;
      }, {});
      setCompResult({ groupedTables: grouped, acordForms: data.differences?.acord_forms });
    } catch (err) {
      setError(err.message || 'Connection failed. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!compResult?.groupedTables) return;
    const rows = [];
    Object.entries(compResult.groupedTables).forEach(([loc, changes]) =>
      changes.forEach(c => rows.push({
        'Page / Location': loc,
        'Change Type':     (c.type || '').toUpperCase(),
        'Old Value':       c.old_value || '',
        'New Value':       c.new_value || '',
        'Confidence':      c.confidence || '',
      }))
    );
    if (!rows.length) { setError('No differences found to export.'); return; }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Differences');
    XLSX.writeFile(wb, `AccuraRate_Report_${Date.now()}.xlsx`);
  };

  const allChanges = compResult?.groupedTables
    ? Object.entries(compResult.groupedTables).flatMap(([loc, arr]) => arr.map(c => ({ ...c, location: loc })))
    : [];
  const filtered = filter === 'all' ? allChanges : allChanges.filter(c => c.type === filter);
  const hasResults = allChanges.length > 0;
  const counts = {
    all: allChanges.length,
    modified: allChanges.filter(c => c.type === 'modified').length,
    added:    allChanges.filter(c => c.type === 'added').length,
    removed:  allChanges.filter(c => c.type === 'removed').length,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#07090f', color: '#e2e8f0', fontFamily: '"DM Sans", -apple-system, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Syne:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes ar-spin   { to { transform: rotate(360deg); } }
        @keyframes ar-fadeup { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ar-fadein { from { opacity:0; } to { opacity:1; } }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 99px; }
        .ar-cta:hover:not(:disabled) { background: #1d4ed8 !important; box-shadow: 0 8px 28px rgba(29,78,216,0.35) !important; transform: translateY(-1px) !important; }
        .ar-cta:active:not(:disabled) { transform: translateY(0) !important; }
        .ar-export:hover:not(:disabled) { background: rgba(20,184,166,0.12) !important; }
        .ar-row:hover { background: rgba(255,255,255,0.02) !important; }
        .ar-filt:hover { color: #94a3b8 !important; }
      `}</style>

      {/* ══════════════ NAVBAR ══════════════════════════════════════════════ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: 'rgba(7,9,15,0.92)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <button onClick={() => setPage('home')} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: 'linear-gradient(145deg, #1d4ed8 0%, #0f172a 100%)',
              border: '1px solid rgba(59,130,246,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#93c5fd', boxShadow: '0 0 16px rgba(29,78,216,0.3)',
            }}>
              <Icon d={Icons.compare} size={14} />
            </div>
            <span style={{ fontFamily: '"Syne", sans-serif', fontWeight: '800', fontSize: '17px', letterSpacing: '-0.025em', color: '#f1f5f9' }}>AccuraRate</span>
          </button>

          {/* Nav links */}
          <div style={{ display: 'flex', gap: '2px' }}>
            {[['About', 'about'], ['Privacy', 'privacy'], ['Support', 'support']].map(([label, key]) => (
              <button key={key} onClick={() => setPage(key)}
                style={{
                  padding: '5px 13px', borderRadius: '7px', fontSize: '13px', fontWeight: '500',
                  color: page === key ? '#f1f5f9' : '#64748b',
                  background: page === key ? 'rgba(255,255,255,0.07)' : 'none',
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (page !== key) e.currentTarget.style.color = '#94a3b8'; }}
                onMouseLeave={e => { if (page !== key) e.currentTarget.style.color = '#64748b'; }}
              >{label}</button>
            ))}
          </div>

          {/* Open source pill */}
          <a href="https://github.com/TestMasterHub/AccuraRate" target="_blank" rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px',
              borderRadius: '20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              fontSize: '11px', fontWeight: '600', color: '#94a3b8', textDecoration: 'none', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12c0-5.523-4.477-10-10-10z"/></svg>
            Open Source
          </a>
        </div>
      </nav>

      {/* ══════════════ HERO ════════════════════════════════════════════════ */}
      {page === 'home' && (
      <div style={{ textAlign: 'center', padding: '56px 24px 40px', position: 'relative', animation: 'ar-fadeup 0.5s ease both' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(29,78,216,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <h1 style={{
          fontFamily: '"Syne", sans-serif', fontWeight: '800',
          fontSize: 'clamp(1.75rem, 4vw, 2.9rem)',
          letterSpacing: '-0.03em', lineHeight: 1.1,
          color: '#f8fafc', marginBottom: '14px',
        }}>
          Compare Insurance PDFs<br />
          <span style={{ color: '#3b82f6' }}>Spot Every Change Instantly.</span>
        </h1>

        <p style={{ fontSize: '15px', color: '#94a3b8', maxWidth: '480px', margin: '0 auto 24px', lineHeight: 1.8 }}>
          Upload two versions of a PDF and see exactly what changed — rates, forms, or policy text. Free, open source, and completely private.
        </p>

        {/* Simple trust pills */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <PrivacyPill icon={Icons.lock}    text="No data stored" />
          <PrivacyPill icon={Icons.eye_off} text="No cookies" />
          <PrivacyPill icon={Icons.shield}  text="No logs" />
          <PrivacyPill icon={Icons.cpu}     text="Open source" />
        </div>
      </div>
      )}

      {/* ══════════════ MAIN ════════════════════════════════════════════════ */}
      {page === 'home' && <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px 80px' }}>

        {/* ── Upload Card ───────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '18px', padding: '28px 28px 22px',
          marginBottom: '20px',
          animation: 'ar-fadeup 0.45s 0.05s ease both',
        }}>

          {/* Step 1 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800', color: '#3b82f6', flexShrink: 0 }}>1</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Upload Documents</span>
          </div>

          {/* Drop zones */}
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginBottom: '22px' }}>
            <DropZone label="Baseline Version" sublabel="e.g. 2024 Rates" badge="OLD" accent="blue"
              file={oldPdf} fileName={oldPdfName}
              onFile={f => handleFile(f, 'old')}
              onClear={() => { setOldPdf(null); setOldPdfName(''); }} />

            <div style={{ display: 'flex', alignItems: 'center', color: '#64748b', fontSize: '20px', paddingTop: '30px', flexShrink: 0 }}>→</div>

            <DropZone label="Updated Version" sublabel="e.g. 2025 Rates" badge="NEW" accent="teal"
              file={newPdf} fileName={newPdfName}
              onFile={f => handleFile(f, 'new')}
              onClear={() => { setNewPdf(null); setNewPdfName(''); }} />
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }} />

          {/* Step 2 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800', color: '#14b8a6', flexShrink: 0 }}>2</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Run Comparison</span>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)',
              borderRadius: '10px', padding: '11px 15px', marginBottom: '14px',
              fontSize: '13px', color: '#fca5a5', animation: 'ar-fadein 0.2s ease',
            }}>
              <span style={{ flexShrink: 0 }}><Icon d={Icons.info} size={15} /></span>
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            className="ar-cta"
            onClick={handleCompare}
            disabled={isLoading || !oldPdf || !newPdf}
            style={{
              width: '100%', padding: '13px 20px',
              background: (isLoading || !oldPdf || !newPdf) ? '#0f172a' : '#2563eb',
              color: (isLoading || !oldPdf || !newPdf) ? '#475569' : '#fff',
              border: `1px solid ${(isLoading || !oldPdf || !newPdf) ? 'rgba(255,255,255,0.04)' : 'rgba(59,130,246,0.5)'}`,
              borderRadius: '11px', fontSize: '14px', fontWeight: '600',
              cursor: (isLoading || !oldPdf || !newPdf) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
              boxShadow: (isLoading || !oldPdf || !newPdf) ? 'none' : '0 4px 18px rgba(37,99,235,0.25)',
            }}
          >
            {isLoading
              ? <><Spinner size={16} color="#60a5fa" /> Analyzing document structure…</>
              : <><Icon d={Icons.compare} size={16} /> Compare Documents</>
            }
          </button>

          {/* Inline privacy assurance */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px', color: '#94a3b8', fontSize: '11px' }}>
            <Icon d={Icons.lock} size={11} />
            Files processed in server RAM only — never stored, never shared, immediately cleared.
          </div>
        </div>

        {/* ── Results ───────────────────────────────────────────────────── */}
        {(summary || isLoading) && (
          <div style={{ animation: 'ar-fadeup 0.4s ease both' }}>

            {/* Stat row */}
            {summary && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
                <StatCard value={summary.total_differences} label="Total Changes"
                  color="#93c5fd" bg="rgba(59,130,246,0.07)"  border="rgba(59,130,246,0.18)" />
                <StatCard value={summary.modifications}     label="Modified"
                  color="#fcd34d" bg="rgba(245,158,11,0.07)"  border="rgba(245,158,11,0.18)" />
                <StatCard value={summary.additions}         label="Added"
                  color="#6ee7b7" bg="rgba(16,185,129,0.07)"  border="rgba(16,185,129,0.18)" />
                <StatCard value={summary.removals}          label="Removed"
                  color="#fca5a5" bg="rgba(239,68,68,0.07)"   border="rgba(239,68,68,0.18)"  />
                {summary.ocr_used && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
                    borderRadius: '12px', background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.18)',
                    fontSize: '11px', color: '#c4b5fd', fontWeight: '600',
                  }}>
                    <Icon d={Icons.ocr} size={15} />
                    OCR used · Scanned pages detected
                    {(summary.scanned_pages_found || []).length > 0 &&
                      <span style={{ color: '#7c3aed', fontSize: '10px' }}>({summary.scanned_pages_found.join(', ')})</span>}
                  </div>
                )}
              </div>
            )}

            {/* Results table card */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '18px', overflow: 'hidden',
            }}>
              {/* Toolbar */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '15px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                flexWrap: 'wrap', gap: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#64748b', display: 'flex' }}><Icon d={Icons.page} size={16} /></span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#e2e8f0' }}>Comparison Results</span>
                  {hasResults && (
                    <span style={{ padding: '1px 8px', borderRadius: '20px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', fontSize: '10px', color: '#93c5fd', fontWeight: '700' }}>
                      {allChanges.length} changes
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Filters */}
                  {[
                    { key: 'all',      label: 'All',      clr: '#93c5fd' },
                    { key: 'modified', label: 'Modified', clr: '#fcd34d' },
                    { key: 'added',    label: 'Added',    clr: '#6ee7b7' },
                    { key: 'removed',  label: 'Removed',  clr: '#fca5a5' },
                  ].map(f => (
                    <button key={f.key} className="ar-filt"
                      onClick={() => setFilter(f.key)}
                      style={{
                        padding: '4px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                        background: filter === f.key ? 'rgba(255,255,255,0.07)' : 'transparent',
                        color: filter === f.key ? f.clr : '#64748b',
                        fontSize: '11px', fontWeight: '600', transition: 'all 0.15s',
                        outline: filter === f.key ? '1px solid rgba(255,255,255,0.09)' : 'none',
                      }}
                    >{f.label} <span style={{ opacity: 0.5 }}>({counts[f.key]})</span></button>
                  ))}

                  <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.07)' }} />

                  {/* Export */}
                  <button className="ar-export"
                    onClick={handleExport}
                    disabled={!hasResults}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '5px 12px', borderRadius: '8px', cursor: hasResults ? 'pointer' : 'not-allowed',
                      background: 'rgba(20,184,166,0.07)', border: '1px solid rgba(20,184,166,0.2)',
                      color: hasResults ? '#5eead4' : '#475569',
                      fontSize: '11px', fontWeight: '600', transition: 'all 0.15s',
                    }}
                  >
                    <Icon d={Icons.download} size={12} /> Export .xlsx
                  </button>
                </div>
              </div>

              {/* Column headers */}
              {hasResults && !isLoading && (
                <div style={{
                  display: 'grid', gridTemplateColumns: '130px 82px 82px 1fr',
                  padding: '8px 22px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  fontSize: '9px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>
                  <span>Location</span><span>Type</span><span>Confidence</span><span>Changes</span>
                </div>
              )}

              {/* Body */}
              <div style={{ maxHeight: '540px', overflowY: 'auto' }}>

                {isLoading && (
                  <div style={{ padding: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
                    <Spinner size={36} color="#3b82f6" />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '4px' }}>Running spatial coordinate analysis…</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Processing in memory only — nothing is saved</div>
                    </div>
                  </div>
                )}

                {!isLoading && hasResults && filtered.length === 0 && (
                  <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
                    No <strong style={{ color: '#e2e8f0' }}>{filter}</strong> changes found.
                  </div>
                )}

                {!isLoading && filtered.map((ch, i) => (
                  <div key={i} className="ar-row" style={{
                    display: 'grid', gridTemplateColumns: '130px 82px 82px 1fr',
                    padding: '12px 22px',
                    borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                    alignItems: 'start', transition: 'background 0.12s',
                    animation: 'ar-fadein 0.25s ease both',
                  }}>
                    {/* Location */}
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '2px 7px', display: 'inline-block', width: 'fit-content', marginTop: '4px' }}>
                      {ch.location}
                    </span>
                    {/* Type */}
                    <div style={{ marginTop: '4px' }}><TypeBadge type={ch.type} /></div>
                    {/* Confidence */}
                    <div style={{ paddingTop: '6px' }}><ConfidenceDot level={ch.confidence} /></div>
                    {/* Smart inline diff */}
                    <InlineDiff oldVal={ch.old_value} newVal={ch.new_value} type={ch.type} />
                  </div>
                ))}

                {/* Identical */}
                {!isLoading && summary && !hasResults && (
                  <div style={{ padding: '60px', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>✓</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#10b981', marginBottom: '5px' }}>Documents are identical</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>No differences detected between the two PDF versions.</div>
                  </div>
                )}

                {/* Pre-compare */}
                {!isLoading && !summary && (
                  <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <div style={{ opacity: 0.06, marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><Icon d={Icons.compare} size={52} /></div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '5px' }}>Awaiting comparison</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Upload both PDF files above and click Compare Documents</div>
                  </div>
                )}
              </div>

              {/* ACORD section */}
              {compResult?.acordForms?.field_changes && Object.keys(compResult.acordForms.field_changes).length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '16px 22px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '10px' }}>
                    ACORD Form Fields · {compResult.acordForms.extraction_mode} extraction
                  </div>
                  <pre style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', overflow: 'auto', maxHeight: '150px', padding: '10px 14px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', lineHeight: 1.6 }}>
                    {JSON.stringify(compResult.acordForms.field_changes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </main>}

      {/* ══════════════ INNER PAGES ═══════════════════════════════════════ */}
      {page === 'about' && <AboutPage onHome={() => setPage('home')} />}
      {page === 'privacy' && <PrivacyPage />}
      {page === 'support' && <SupportPage />}

      {/* ══════════════ FOOTER ══════════════════════════════════════════════ */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '24px', fontSize: '12px', color: '#d7dce2' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <span>© {new Date().getFullYear()} AccuraRate by TestMasterHub · Free & Open Source</span>
          <div style={{ display: 'flex', gap: '20px' }}>
            {[['About', 'about'], ['Privacy', 'privacy'], ['Support', 'support']].map(([label, key]) => (
              <button key={key} onClick={() => setPage(key)}
                style={{ color: '#d7dce2', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                onMouseLeave={e => e.currentTarget.style.color = '#475569'}
              >{label}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Shared inner page wrapper ─────────────────────────────────────────────────
const PageWrap = ({ children }) => (
  <div style={{ maxWidth: '720px', margin: '0 auto', padding: '56px 24px 80px', animation: 'ar-fadeup 0.4s ease both' }}>
    {children}
  </div>
);
const PageTitle = ({ children }) => (
  <h1 style={{ fontFamily: '"Syne", sans-serif', fontWeight: '800', fontSize: '2rem', letterSpacing: '-0.025em', color: '#f1f5f9', marginBottom: '8px' }}>{children}</h1>
);
const PageSub = ({ children }) => (
  <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '36px', lineHeight: 1.7 }}>{children}</p>
);
const Section = ({ title, children }) => (
  <div style={{ marginBottom: '32px' }}>
    <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#cbd5e1', marginBottom: '10px', letterSpacing: '0.01em' }}>{title}</h2>
    <div style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.8 }}>{children}</div>
  </div>
);
const Divider = () => <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '32px 0' }} />;

// ── About Page ────────────────────────────────────────────────────────────────
const AboutPage = ({ onHome }) => (
  <PageWrap>
    <PageTitle>About AccuraRate</PageTitle>
    <PageSub>A free, open source tool for comparing insurance PDFs — built for accuracy and privacy.</PageSub>

    <Section title="What it does">
      AccuraRate lets you upload two versions of an insurance PDF and instantly see what changed — whether that's a rate, a form field, or a line of policy text. Results are highlighted at the token level so you can spot the exact difference, not just the row it's in.
    </Section>

    <Section title="Who it's for">
      Insurance professionals, actuaries, compliance teams, and developers who need to track changes between document versions quickly and reliably — without uploading files to a third-party service.
    </Section>

    <Section title="How it works">
      Your files are sent to a private Python backend, compared in memory, and the results are returned to your browser. The backend process ends immediately after. Nothing is saved, logged, or cached at any point.
    </Section>

    <Section title="Open Source">
      AccuraRate is free and open source. You can inspect the code, self-host the backend, or contribute on GitHub.
      <div style={{ marginTop: '14px' }}>
        <a href="https://github.com/testmasterhub/accurarrate" target="_blank" rel="noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', borderRadius: '9px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#e2e8f0', fontSize: '13px', fontWeight: '600', textDecoration: 'none', transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12c0-5.523-4.477-10-10-10z"/></svg>
          View on GitHub
        </a>
      </div>
    </Section>

    <Section title="Built by">
      TestMasterHub — a small team building practical tools for insurance and compliance workflows.
    </Section>

    <Divider />
    <button onClick={onHome} style={{ fontSize: '13px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      ← Back to comparison tool
    </button>
  </PageWrap>
);

// ── Privacy Page ──────────────────────────────────────────────────────────────
const PrivacyPage = () => (
  <PageWrap>
    <PageTitle>Privacy Policy</PageTitle>
    <PageSub>Plain English. No legalese.</PageSub>

    <div style={{
      background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
      borderRadius: '12px', padding: '18px 20px', marginBottom: '32px',
      display: 'flex', gap: '14px', alignItems: 'flex-start',
    }}>
      <span style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </span>
      <div style={{ fontSize: '14px', color: '#6ee7b7', lineHeight: 1.75 }}>
        <strong>The short version:</strong> We collect nothing. Your files are processed and immediately discarded. There are no accounts, no cookies, no tracking, and no logs.
      </div>
    </div>

    <Section title="Your files">
      When you upload PDFs, they are sent over HTTPS to our backend server. The server reads them in memory, compares them, and returns the results. The files are never written to disk, never stored in a database, and never shared with anyone. The moment your request completes, the data is gone.
    </Section>

    <Section title="Cookies">
      We use zero cookies. No session cookies, no analytics cookies, no advertising cookies. Nothing is stored in your browser.
    </Section>

    <Section title="Logs">
      We do not keep access logs, error logs tied to your content, or any record of what documents you uploaded. Standard server infrastructure may briefly retain connection metadata (IP address, timestamp) for security purposes only, and this is purged automatically.
    </Section>

    <Section title="Analytics & tracking">
      There is no analytics, no tracking pixels, no third-party scripts, and no fingerprinting of any kind on this site.
    </Section>

    <Section title="Third parties">
      Your documents are never sent to any third-party service, API, or AI platform. All processing happens on our own server.
    </Section>

    <Section title="Children">
      This tool is not directed at children under 13. We do not knowingly collect any information from children.
    </Section>

    <Section title="Changes">
      If we ever change this policy in a meaningful way, we'll update this page and note the date. Last updated: February 2026.
    </Section>

    <Divider />
    <p style={{ fontSize: '13px', color: '#475569' }}>Questions? Reach us on the <button onClick={() => {}} style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '13px' }}>Support</button> page.</p>
  </PageWrap>
);

// ── Support Page ──────────────────────────────────────────────────────────────
const SupportPage = () => {
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent]       = useState(false);

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px',
    padding: '10px 14px', fontSize: '14px', color: '#e2e8f0',
    outline: 'none', transition: 'border-color 0.15s', fontFamily: 'inherit',
  };

  if (sent) return (
    <PageWrap>
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>✓</div>
        <PageTitle>Message sent</PageTitle>
        <PageSub>Thanks for reaching out. We'll get back to you as soon as we can.</PageSub>
      </div>
    </PageWrap>
  );

  return (
    <PageWrap>
      <PageTitle>Support</PageTitle>
      <PageSub>Found a bug, have a question, or want to request a feature? We'd love to hear from you.</PageSub>

      <Section title="GitHub Issues (preferred)">
        The fastest way to report a bug or request a feature is to open an issue on GitHub. You can also browse existing issues to see if your question has already been answered.
        <div style={{ marginTop: '12px' }}>
          <a href="https://github.com/testmasterhub/accurarrate/issues" target="_blank" rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '7px 14px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#e2e8f0', fontSize: '13px', fontWeight: '600', textDecoration: 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12c0-5.523-4.477-10-10-10z"/></svg>
            Open an Issue
          </a>
        </div>
      </Section>

      <Divider />

      <Section title="Send a message">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" type="email"
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe your issue or question…" rows={5}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }}
            onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
          <button
            onClick={() => { if (name && email && message) setSent(true); }}
            disabled={!name || !email || !message}
            style={{
              padding: '11px', borderRadius: '10px', border: 'none', cursor: (!name || !email || !message) ? 'not-allowed' : 'pointer',
              background: (!name || !email || !message) ? 'rgba(255,255,255,0.04)' : '#2563eb',
              color: (!name || !email || !message) ? '#475569' : '#fff',
              fontSize: '14px', fontWeight: '600', transition: 'all 0.2s',
            }}
          >Send Message</button>
        </div>
      </Section>
    </PageWrap>
  );
};