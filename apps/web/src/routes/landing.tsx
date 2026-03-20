import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import '../styles/landing.css'

/* ── useInView hook ── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, visible }
}

function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  const { ref, visible } = useInView()
  return (
    <div ref={ref} data-visible={visible} className={`lp-section ${className}`} id={id}>
      {children}
    </div>
  )
}

/* ── Nav ── */
function Nav() {
  const nav = useNavigate()
  return (
    <nav className="lp-nav">
      <div className="lp-nav__inner">
        <Link className="lp-nav__logo" to="/">
          <div className="lp-nav__logo-mark">F</div>
          Formbase
        </Link>
        <div className="lp-nav__links">
          <a className="lp-nav__link" href="#features">Features</a>
          <a className="lp-nav__link" href="#api">API</a>
          <a className="lp-nav__link" href="https://github.com/formbase/formbase" target="_blank" rel="noopener noreferrer">GitHub</a>
          <button className="lp-nav__cta" onClick={() => nav('/editor')}>
            Try Editor
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </div>
    </nav>
  )
}

/* ── Hero ── */
function Hero() {
  const nav = useNavigate()
  return (
    <Section className="lp-hero">
      <div className="lp-hero__badge">
        <span className="lp-hero__badge-dot" />
        Open Source &middot; MIT Licensed
      </div>
      <h1>
        The PDF form editor<br />
        <span>React deserved.</span>
      </h1>
      <p className="lp-hero__sub">
        Drop fields onto any PDF. Export AcroForm-ready documents. Build
        signing workflows with a composable, PDF-native React component.
      </p>
      <div className="lp-hero__actions">
        <button className="lp-btn lp-btn--primary" onClick={() => nav('/editor')}>
          Open Editor
          <span aria-hidden="true">&rarr;</span>
        </button>
        <a className="lp-btn lp-btn--ghost" href="#get-started">Get Started</a>
      </div>

      {/* CSS Editor Mockup */}
      <div className="lp-hero__mockup">
        <div className="lp-mockup__toolbar">
          <span className="lp-mockup__dot lp-mockup__dot--r" />
          <span className="lp-mockup__dot lp-mockup__dot--y" />
          <span className="lp-mockup__dot lp-mockup__dot--g" />
          <span className="lp-mockup__title">contract.pdf — Formbase Editor</span>
        </div>
        <div className="lp-mockup__body">
          <div className="lp-mockup__sidebar">
            <div className="lp-mockup__sidebar-label">Field Palette</div>
            {[
              { name: 'Text Input', color: '#e8793b' },
              { name: 'Signature', color: '#7c68ee' },
              { name: 'Date', color: '#3bb2e8' },
              { name: 'Checkbox', color: '#5a9a63' },
              { name: 'Dropdown', color: '#c586c0' },
              { name: 'Initials', color: '#c8a62c' },
            ].map(f => (
              <div key={f.name} className="lp-mockup__field-item">
                <span className="lp-mockup__field-dot" style={{ background: f.color }} />
                {f.name}
              </div>
            ))}
          </div>
          <div className="lp-mockup__canvas">
            <div className="lp-mockup__page">
              <div className="lp-mockup__page-line" />
              <div className="lp-mockup__page-line" />
              <div className="lp-mockup__page-line" />
              <div className="lp-mockup__placed-field">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><line x1="5" y1="8" x2="11" y2="8"/></svg>
                Full Name
              </div>
              <div className="lp-mockup__placed-field">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12 C5 8 8 4 13 3"/></svg>
                Signature
              </div>
            </div>
          </div>
          <div className="lp-mockup__inspector">
            <div className="lp-mockup__inspector-title">Inspector</div>
            {[
              ['Type', 'text'], ['Label', 'Full Name'], ['Page', '1'],
              ['X (pt)', '72.0'], ['Y (pt)', '680.5'], ['Width', '200'],
              ['Height', '24'], ['Required', 'true'],
            ].map(([k, v]) => (
              <div key={k} className="lp-mockup__inspector-row">
                <span>{k}</span><span>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}

/* ── Problem / Solution ── */
function Compare() {
  return (
    <Section className="lp-compare">
      <div className="lp-compare__header">
        <h2>Stop fighting PDF coordinates</h2>
        <p>PDF uses bottom-left origin. Browsers use top-left. Formbase handles the Y-flip so you never have to.</p>
      </div>
      <div className="lp-compare__grid">
        <div className="lp-compare__col lp-compare__col--before">
          <div className="lp-compare__col-head">Without Formbase</div>
          <div className="lp-compare__code">
            <pre>{`// Manual PDF coordinate math
const screenY = (pageHeight - pdfY - fieldH)
                * (canvas.height / pageHeight)
                * window.devicePixelRatio;

// Reverse on every drag event
const pdfY = pageHeight
             - (screenY / scale / dpr)
             - fieldH;

// Handle each field type manually
// Parse AcroForm dictionaries
// Manage undo/redo state
// Wire up keyboard shortcuts
// ...hundreds more lines`}</pre>
          </div>
        </div>
        <div className="lp-compare__col lp-compare__col--after">
          <div className="lp-compare__col-head">With Formbase</div>
          <div className="lp-compare__code">
            <pre><span className="syn-kw">import</span> {'{'} <span className="syn-cmp">PdfFormEditor</span> {'}'} <span className="syn-kw">from</span> <span className="syn-str">'@formpdf/editor'</span>{'\n'}<span className="syn-kw">import</span> <span className="syn-str">'@formpdf/editor/styles.css'</span>{'\n\n'}<span className="syn-kw">function</span> <span className="syn-fn">App</span>() {'{\n'}{`  `}<span className="syn-kw">return</span> ({'\n'}{`    `}<span className="syn-pnc">&lt;</span><span className="syn-cmp">PdfFormEditor</span>{'\n'}{`      `}<span className="syn-attr">pdfUrl</span><span className="syn-pnc">=</span><span className="syn-str">"/contract.pdf"</span>{'\n'}{`      `}<span className="syn-attr">aiProxyUrl</span><span className="syn-pnc">=</span><span className="syn-str">"/api/detect"</span>{'\n'}{`    `}<span className="syn-pnc">/&gt;</span>{'\n'}{`  `}){'\n'}{'}'}</pre>
          </div>
        </div>
      </div>
    </Section>
  )
}

/* ── Features ── */
const FEATURES = [
  { icon: 'fields', emoji: 'Aa', title: '6 Field Types', desc: 'Text, signature, initials, date, checkbox, and dropdown — each with PDF-native sizing defaults.' },
  { icon: 'ai', emoji: 'AI', title: 'AI Field Detection', desc: 'Send page images to your AI proxy. Auto-detect where fields belong and what type they are.' },
  { icon: 'compose', emoji: '{}', title: 'Composable API', desc: 'Use the full editor or import individual pieces: CoordEngine, stores, field components.' },
  { icon: 'export', emoji: 'PDF', title: 'AcroForm Export', desc: 'Export to real PDF form fields via pdf-lib. Text fields, checkboxes, dropdowns — all AcroForm compliant.' },
  { icon: 'coords', emoji: 'Y', title: 'PDF-Native Coords', desc: 'Fields stored in PDF points (bottom-left origin). CoordEngine handles the Y-flip transparently.' },
  { icon: 'keyboard', emoji: 'KB', title: 'Keyboard-First', desc: 'T/S/D/C to add fields. Ctrl+Z undo. Ctrl+D duplicate. Delete to remove. Escape to deselect.' },
]

function Features() {
  return (
    <Section className="lp-features" id="features">
      <div className="lp-features__header">
        <h2>Everything you need</h2>
        <p>A complete toolkit for building PDF form workflows in React.</p>
      </div>
      <div className="lp-features__grid">
        {FEATURES.map(f => (
          <div key={f.title} className="lp-feature-card">
            <div className={`lp-feature-card__icon lp-feature-card__icon--${f.icon}`}>{f.emoji}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ── Code Tabs ── */
const CODE_EXAMPLES = [
  { label: 'Full Editor', code: `import { PdfFormEditor } from '@formpdf/editor'\nimport '@formpdf/editor/styles.css'\n\nexport default function App() {\n  return (\n    <PdfFormEditor\n      pdfUrl="/contract.pdf"\n      aiProxyUrl="/api/pdf-detect"\n      onSave={(bytes) => upload(bytes)}\n    />\n  )\n}` },
  { label: 'Custom Layout', code: `import { EditorProvider, PdfCanvas, FieldLayer }\n  from '@formpdf/editor'\n\n// Build your own layout\nfunction CustomEditor() {\n  return (\n    <EditorProvider aiProxyUrl="/api/detect">\n      <YourToolbar />\n      <PdfCanvas pdfFile={file} scale={zoom}>\n        {(pageIdx) => <FieldLayer pageIdx={pageIdx} />}\n      </PdfCanvas>\n      <YourPropsPanel />\n    </EditorProvider>\n  )\n}` },
  { label: 'Headless Export', code: `import { useFormExport } from '@formpdf/editor'\n\nfunction SaveButton() {\n  const { exportJSON, exportToPdf } = useFormExport()\n\n  async function handleSave() {\n    const schema = exportJSON()\n    const pdfBytes = await exportToPdf(originalFile)\n    await fetch('/api/save', {\n      method: 'POST',\n      body: pdfBytes,\n    })\n  }\n\n  return <button onClick={handleSave}>Save</button>\n}` },
]

function CodeTabs() {
  const [active, setActive] = useState(0)
  return (
    <Section className="lp-code-section" id="api">
      <div className="lp-code-section__header">
        <h2>Use it your way</h2>
        <p>Drop in the full editor, compose your own layout, or go headless.</p>
      </div>
      <div className="lp-code-tabs">
        {CODE_EXAMPLES.map((ex, i) => (
          <button key={ex.label} className={`lp-code-tab ${i === active ? 'lp-code-tab--active' : ''}`} onClick={() => setActive(i)}>
            {ex.label}
          </button>
        ))}
      </div>
      <div className="lp-code-block">
        <pre>{CODE_EXAMPLES[active].code}</pre>
      </div>
    </Section>
  )
}

/* ── Architecture ── */
function Architecture() {
  return (
    <Section className="lp-arch">
      <div className="lp-arch__header">
        <h2>PDF-native by design</h2>
        <p>Fields are stored in PDF user-space points. The CoordEngine handles all coordinate transforms.</p>
      </div>
      <div className="lp-arch__flow">
        <div className="lp-arch__node lp-arch__node--pdf"><div className="lp-arch__node-label">PDF Points</div><div className="lp-arch__node-code">origin: bottom-left<br />unit: 1/72 inch</div></div>
        <div className="lp-arch__arrow">&rarr;</div>
        <div className="lp-arch__node lp-arch__node--engine"><div className="lp-arch__node-label">CoordEngine</div><div className="lp-arch__node-code">Y-flip + scale<br />per-page transform</div></div>
        <div className="lp-arch__arrow">&rarr;</div>
        <div className="lp-arch__node lp-arch__node--screen"><div className="lp-arch__node-label">Screen Pixels</div><div className="lp-arch__node-code">origin: top-left<br />CSS pixels</div></div>
      </div>
      <div className="lp-arch__formula">
        <code>screenY = (pageHeightPt - ptY - ptH) * scaleY</code>
      </div>
    </Section>
  )
}

/* ── Steps ── */
function Steps() {
  return (
    <Section className="lp-steps" id="get-started">
      <div className="lp-steps__header"><h2>Up and running in 3 steps</h2></div>
      <div className="lp-steps__grid">
        <div className="lp-step"><div className="lp-step__num">1</div><h3>Install</h3><p>Add the package to your React project.</p><div className="lp-step__code"><pre>npm install @formpdf/editor</pre></div></div>
        <div className="lp-step"><div className="lp-step__num">2</div><h3>Import</h3><p>Add the editor component and stylesheet.</p><div className="lp-step__code"><pre>{`import { PdfFormEditor }\n  from '@formpdf/editor'\nimport '@formpdf/editor/styles.css'`}</pre></div></div>
        <div className="lp-step"><div className="lp-step__num">3</div><h3>Export</h3><p>Get a JSON schema or an AcroForm PDF.</p><div className="lp-step__code"><pre>{`const schema = exportJSON()\nconst pdf = await exportToPdf(file)`}</pre></div></div>
      </div>
    </Section>
  )
}

/* ── CTA ── */
function CtaSection() {
  const nav = useNavigate()
  return (
    <Section className="lp-cta">
      <div className="lp-cta__box">
        <h2>MIT Licensed. Free Forever.</h2>
        <p>Build PDF form workflows without vendor lock-in. Contribute, extend, and ship with confidence.</p>
        <div className="lp-cta__actions">
          <button className="lp-btn lp-btn--white" onClick={() => nav('/editor')}>Try the Editor <span aria-hidden="true">&rarr;</span></button>
          <a className="lp-btn lp-btn--outline" href="https://github.com/formbase/formbase" target="_blank" rel="noopener noreferrer">View on GitHub</a>
        </div>
      </div>
    </Section>
  )
}

/* ── Footer ── */
function Footer() {
  return (
    <footer className="lp-footer">
      <span>Formbase &middot; MIT License</span>
      <div className="lp-footer__links">
        <a href="https://github.com/formbase/formbase" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="#features">Features</a>
        <a href="#api">API</a>
      </div>
    </footer>
  )
}

export default function LandingRoute() {
  return (
    <div className="lp">
      <Nav />
      <Hero />
      <Compare />
      <Features />
      <CodeTabs />
      <Architecture />
      <Steps />
      <CtaSection />
      <Footer />
    </div>
  )
}
