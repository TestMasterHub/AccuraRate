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
        <span style={{ fontSize: '11px', color: '#334155', marginLeft: 'auto' }}>{sublabel}</span>
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
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{(file.size / 1024).toFixed(1)} KB · PDF</div>
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
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2d3f55',
            }}>
              <Icon d={Icons.upload} size={19} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#4a5e78' }}>
                Drop PDF here or <span style={{ color: c.a, fontWeight: '600' }}>browse</span>
              </div>
              <div style={{ fontSize: '11px', color: '#1e2d3d', marginTop: '4px' }}>PDF files only</div>
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
    fontSize: '11px', fontWeight: '500', color: '#475569',
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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#475569' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors[level] || '#475569', display: 'inline-block', flexShrink: 0 }} />
      {level || 'N/A'}
    </span>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ value, label, color, bg, border }) => (
  <div style={{ flex: 1, minWidth: '105px', background: bg, border: `1px solid ${border}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
    <div style={{ fontFamily: '"Syne", sans-serif', fontSize: '2rem', fontWeight: '800', color, lineHeight: 1 }}>{value ?? '—'}</div>
    <div style={{ fontSize: '9px', fontWeight: '700', color: '#334155', marginTop: '6px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
  </div>
);

// ── Feature Card ──────────────────────────────────────────────────────────────
const FeatureCard = ({ icon, title, desc }) => (
  <div
    style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', transition: 'border-color 0.2s' }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
  >
    <div style={{ color: '#3b82f6', marginBottom: '10px', display: 'flex' }}><Icon d={icon} size={18} /></div>
    <div style={{ fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>{title}</div>
    <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.7 }}>{desc}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            <span style={{ fontSize: '9px', fontWeight: '700', color: '#334155', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px' }}>v2</span>
          </div>

          {/* Security badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 12px 4px 9px',
            borderRadius: '20px', background: 'rgba(20,184,166,0.07)', border: '1px solid rgba(20,184,166,0.18)',
          }}>
            <Icon d={Icons.shield} size={12} />
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#5eead4' }}>Zero Storage · In-Memory Processing · NPI Compliant</span>
          </div>

          <div style={{ display: 'flex', gap: '2px' }}>
            {['Docs', 'API', 'Support'].map(l => (
              <a key={l} href="#" style={{ padding: '5px 11px', borderRadius: '7px', fontSize: '12px', fontWeight: '500', color: '#334155', transition: 'color 0.15s' }}
                onMouseEnter={e => e.target.style.color = '#94a3b8'}
                onMouseLeave={e => e.target.style.color = '#334155'}>{l}</a>
            ))}
          </div>
        </div>
      </nav>

      {/* ══════════════ HERO ════════════════════════════════════════════════ */}
      <div style={{ textAlign: 'center', padding: '60px 24px 48px', position: 'relative', animation: 'ar-fadeup 0.5s ease both' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(29,78,216,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <h1 style={{
          fontFamily: '"Syne", sans-serif', fontWeight: '800',
          fontSize: 'clamp(1.75rem, 4vw, 2.9rem)',
          letterSpacing: '-0.03em', lineHeight: 1.1,
          color: '#f8fafc', marginBottom: '14px',
        }}>
          Insurance PDF Comparison<br />
          <span style={{ color: '#3b82f6' }}>Engineered for Accuracy.</span>
        </h1>

        <p style={{ fontSize: '15px', color: '#475569', maxWidth: '540px', margin: '0 auto 28px', lineHeight: 1.8 }}>
          Detect every rate change, form edit, and policy wording difference using coordinate-anchored spatial analysis and the Hungarian Algorithm — no AI, no cloud uploads.
        </p>

        {/* Trust pills */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <PrivacyPill icon={Icons.lock}    text="Files never written to disk" />
          <PrivacyPill icon={Icons.eye_off} text="No third-party AI or cloud APIs" />
          <PrivacyPill icon={Icons.cpu}     text="Pure Python · pdfplumber + PyMuPDF" />
          <PrivacyPill icon={Icons.math}    text="Hungarian Algorithm row matching" />
        </div>
      </div>

      {/* ══════════════ MAIN ════════════════════════════════════════════════ */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px 80px' }}>

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
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#334155', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Upload Documents</span>
          </div>

          {/* Drop zones */}
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginBottom: '22px' }}>
            <DropZone label="Baseline Version" sublabel="e.g. 2024 Rates" badge="OLD" accent="blue"
              file={oldPdf} fileName={oldPdfName}
              onFile={f => handleFile(f, 'old')}
              onClear={() => { setOldPdf(null); setOldPdfName(''); }} />

            <div style={{ display: 'flex', alignItems: 'center', color: '#1e293b', fontSize: '20px', paddingTop: '30px', flexShrink: 0 }}>→</div>

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
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#334155', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Run Comparison</span>
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
              background: (isLoading || !oldPdf || !newPdf) ? '#0d1117' : '#2563eb',
              color: (isLoading || !oldPdf || !newPdf) ? '#1e293b' : '#fff',
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px', color: '#1e293b', fontSize: '11px' }}>
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
                  <span style={{ color: '#475569', display: 'flex' }}><Icon d={Icons.page} size={16} /></span>
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
                        color: filter === f.key ? f.clr : '#334155',
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
                      color: hasResults ? '#5eead4' : '#1e293b',
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
                  display: 'grid', gridTemplateColumns: '130px 82px 82px 1fr 1fr',
                  padding: '8px 22px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  fontSize: '9px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>
                  <span>Location</span><span>Type</span><span>Confidence</span><span>Old Value</span><span>New Value</span>
                </div>
              )}

              {/* Body */}
              <div style={{ maxHeight: '540px', overflowY: 'auto' }}>

                {isLoading && (
                  <div style={{ padding: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
                    <Spinner size={36} color="#3b82f6" />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Running spatial coordinate analysis…</div>
                      <div style={{ fontSize: '11px', color: '#1e293b' }}>Applying Hungarian Algorithm for row matching · Processing in memory only</div>
                    </div>
                  </div>
                )}

                {!isLoading && hasResults && filtered.length === 0 && (
                  <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#334155' }}>
                    No <strong style={{ color: '#64748b' }}>{filter}</strong> changes found.
                  </div>
                )}

                {!isLoading && filtered.map((ch, i) => (
                  <div key={i} className="ar-row" style={{
                    display: 'grid', gridTemplateColumns: '130px 82px 82px 1fr 1fr',
                    padding: '11px 22px',
                    borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                    alignItems: 'start', transition: 'background 0.12s',
                    animation: 'ar-fadein 0.25s ease both',
                  }}>
                    {/* Location */}
                    <span style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '2px 6px', display: 'inline-block', width: 'fit-content' }}>
                      {ch.location}
                    </span>
                    {/* Type */}
                    <div><TypeBadge type={ch.type} /></div>
                    {/* Confidence */}
                    <div style={{ paddingTop: '2px' }}><ConfidenceDot level={ch.confidence} /></div>
                    {/* Old */}
                    <div style={{
                      fontSize: '12px', lineHeight: 1.55, fontFamily: 'monospace',
                      color: ch.type === 'added' ? '#1e293b' : '#fca5a5',
                      background: ch.type !== 'added' ? 'rgba(239,68,68,0.05)' : 'transparent',
                      padding: '3px 7px', borderRadius: '5px',
                      textDecoration: ch.type === 'modified' ? 'line-through' : 'none',
                    }}>
                      {ch.type === 'added' ? '—' : (ch.old_value || 'N/A')}
                    </div>
                    {/* New */}
                    <div style={{
                      fontSize: '12px', lineHeight: 1.55, fontFamily: 'monospace',
                      color: ch.type === 'removed' ? '#1e293b' : '#6ee7b7',
                      background: ch.type !== 'removed' ? 'rgba(16,185,129,0.05)' : 'transparent',
                      padding: '3px 7px', borderRadius: '5px',
                    }}>
                      {ch.type === 'removed' ? '—' : (ch.new_value || 'N/A')}
                    </div>
                  </div>
                ))}

                {/* Identical */}
                {!isLoading && summary && !hasResults && (
                  <div style={{ padding: '60px', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>✓</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#10b981', marginBottom: '5px' }}>Documents are identical</div>
                    <div style={{ fontSize: '12px', color: '#334155' }}>No differences detected between the two PDF versions.</div>
                  </div>
                )}

                {/* Pre-compare */}
                {!isLoading && !summary && (
                  <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <div style={{ opacity: 0.06, marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><Icon d={Icons.compare} size={52} /></div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '5px' }}>Awaiting comparison</div>
                    <div style={{ fontSize: '11px', color: '#0f172a' }}>Upload both PDF files above and click Compare Documents</div>
                  </div>
                )}
              </div>

              {/* ACORD section */}
              {compResult?.acordForms?.field_changes && Object.keys(compResult.acordForms.field_changes).length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '16px 22px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#334155', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '10px' }}>
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
      </main>

      {/* ══════════════ HOW IT WORKS ════════════════════════════════════════ */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '56px 24px', background: 'rgba(0,0,0,0.25)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#1e293b', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px' }}>Under the Hood</div>
            <h2 style={{ fontFamily: '"Syne", sans-serif', fontWeight: '800', fontSize: '1.65rem', color: '#f1f5f9', letterSpacing: '-0.025em' }}>
              Pure Python. No AI. No Black Box.
            </h2>
            <p style={{ fontSize: '13px', color: '#334155', marginTop: '8px', maxWidth: '500px', margin: '10px auto 0', lineHeight: 1.75 }}>
              Every algorithm is deterministic, auditable, and runs entirely on your infrastructure.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '12px' }}>
            <FeatureCard icon={Icons.cpu}      title="Coordinate-Anchored Extraction"    desc="pdfplumber extracts every word with exact X/Y bounding-box coordinates. Columns never drift — even across multi-line headers." />
            <FeatureCard icon={Icons.math}     title="Hungarian Algorithm Matching"       desc="scipy.optimize.linear_sum_assignment finds globally optimal row pairings using 60% SequenceMatcher + 40% Jaccard similarity." />
            <FeatureCard icon={Icons.lock}     title="In-Memory Only · Zero Storage"     desc="All files are read into io.BytesIO RAM buffers. Nothing is written to disk. Memory is force-garbage-collected after each request." />
            <FeatureCard icon={Icons.ocr}      title="OCR Fallback for Scanned PDFs"     desc="Scanned pages are rasterized at 300 DPI via PyMuPDF and processed through Tesseract OCR entirely in-memory." />
            <FeatureCard icon={Icons.page}     title="ACORD Form Intelligence"           desc="AcroForm widget extraction for interactive fields. Checkbox normalization included. Falls back to spatial extraction if flattened." />
            <FeatureCard icon={Icons.shield}   title="NPI Compliant · HIPAA Ready"       desc="Zero cloud API calls. All processing on your server. No personal data leaves your infrastructure at any stage." />
          </div>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════════════════════════════════════ */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '22px 24px', fontSize: '11px', color: '#1e293b' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span>© {new Date().getFullYear()} <strong style={{ color: '#334155' }}>AccuraRate</strong> by TestMasterHub · Spatial PDF Comparison Engine</span>
          <div style={{ display: 'flex', gap: '20px' }}>
            {['Privacy Policy', 'Terms of Use', 'Contact'].map(l => (
              <a key={l} href="#" style={{ color: '#1e293b', fontSize: '11px', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.target.style.color = '#475569'}
                onMouseLeave={e => e.target.style.color = '#1e293b'}>{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}