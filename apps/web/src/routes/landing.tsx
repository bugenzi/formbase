import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/landing.css'

/* ── Single-pass syntax highlighter ── */
const KEYWORDS = new Set([
  'import','from','export','default','function','return','const','let',
  'var','async','await','new','if','else','for','while','class','extends',
])

function tokenize(code: string): Array<{ text: string; type: string }> {
  const tokens: Array<{ text: string; type: string }> = []
  let i = 0

  while (i < code.length) {
    // Comments: //
    if (code[i] === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i)
      const slice = end === -1 ? code.slice(i) : code.slice(i, end)
      tokens.push({ text: slice, type: 'cmt' })
      i += slice.length
      continue
    }

    // Strings: ' " `
    if (code[i] === "'" || code[i] === '"' || code[i] === '`') {
      const quote = code[i]
      let j = i + 1
      while (j < code.length && code[j] !== quote) {
        if (code[j] === '\\') j++
        j++
      }
      tokens.push({ text: code.slice(i, j + 1), type: 'str' })
      i = j + 1
      continue
    }

    // JSX: < or </
    if (code[i] === '<' && /[A-Za-z\/]/.test(code[i + 1] || '')) {
      const isClosing = code[i + 1] === '/'
      const start = isClosing ? i + 2 : i + 1
      let j = start
      while (j < code.length && /[\w.]/.test(code[j])) j++
      const tagName = code.slice(start, j)
      if (tagName.length > 0) {
        tokens.push({ text: code.slice(i, start), type: 'pnc' })
        const cls = tagName[0] === tagName[0].toUpperCase() ? 'cmp' : 'tag'
        tokens.push({ text: tagName, type: cls })
        i = j
        continue
      }
    }

    if (/[a-zA-Z_$]/.test(code[i])) {
      let j = i
      while (j < code.length && /[\w$]/.test(code[j])) j++
      const word = code.slice(i, j)
      if (KEYWORDS.has(word)) {
        tokens.push({ text: word, type: 'kw' })
      } else if (j < code.length && code[j] === '=') {
        tokens.push({ text: word, type: 'attr' })
      } else {
        tokens.push({ text: word, type: '' })
      }
      i = j
      continue
    }

    if (/\d/.test(code[i])) {
      let j = i
      while (j < code.length && /[\d.]/.test(code[j])) j++
      tokens.push({ text: code.slice(i, j), type: 'num' })
      i = j
      continue
    }

    tokens.push({ text: code[i], type: '' })
    i++
  }

  return tokens
}

function SyntaxPre({ code }: { code: string }) {
  const tokens = useMemo(() => tokenize(code), [code])
  return (
    <pre>
      {tokens.map((t, i) =>
        t.type ? <span key={i} className={`sh-${t.type}`}>{t.text}</span> : t.text
      )}
    </pre>
  )
}

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function S({ children, className = '', id, delay = 0 }: { children: React.ReactNode; className?: string; id?: string; delay?: number }) {
  const { ref, visible } = useInView()
  return (
    <div
      ref={ref}
      className={`lp-reveal ${visible ? 'lp-reveal--in' : ''} ${className}`}
      id={id}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function TypeWriter({ words, className }: { words: string[]; className?: string }) {
  const [idx, setIdx] = useState(0)
  const [text, setText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const word = words[idx]
    const speed = deleting ? 40 : 80

    if (!deleting && text === word) {
      const t = setTimeout(() => setDeleting(true), 2200)
      return () => clearTimeout(t)
    }
    if (deleting && text === '') {
      setDeleting(false)
      setIdx((idx + 1) % words.length)
      return
    }

    const t = setTimeout(() => {
      setText(deleting ? word.slice(0, text.length - 1) : word.slice(0, text.length + 1))
    }, speed)
    return () => clearTimeout(t)
  }, [text, deleting, idx, words])

  return <span className={className}>{text}<span className="lp-cursor" /></span>
}

function Nav() {
  const nav = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <nav className={`lp-nav ${scrolled ? 'lp-nav--scrolled' : ''}`}>
      <div className="lp-nav__inner">
        <a className="lp-nav__logo" href="/">
          <span className="lp-nav__logo-icon">F</span>
          <span className="lp-nav__logo-text">formbase</span>
        </a>
        <div className="lp-nav__links">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="https://github.com/bugenzi/formbase" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
        <button className="lp-nav__cta" onClick={() => nav('/editor')}>
          Open Editor
        </button>
      </div>
    </nav>
  )
}

function Hero() {
  const nav = useNavigate()
  return (
    <section className="lp-hero">
      <div className="lp-hero__bg" aria-hidden="true">
        <div className="lp-hero__orb lp-hero__orb--1" />
        <div className="lp-hero__orb lp-hero__orb--2" />
        <div className="lp-hero__grid-lines" />
      </div>

      <S className="lp-hero__content">
        <div className="lp-hero__pill">
          <span className="lp-hero__pill-dot" />
          Open Source &middot; MIT Licensed
        </div>

        <h1 className="lp-hero__title">
          PDF forms for<br />
          <TypeWriter
            words={['leases', 'offer letters', 'invoices', 'contracts', 'intake forms']}
            className="lp-hero__typed"
          />
        </h1>

        <p className="lp-hero__sub">
          Start in the visual editor, then ship the same workflow in React.<br />
          Export JSON schemas or fillable PDFs from the same package.
        </p>

        <div className="lp-hero__actions">
          <button className="lp-btn lp-btn--primary" onClick={() => nav('/editor')}>
            Try the Editor
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
          </button>
          <a className="lp-btn lp-btn--glass" href="#how-it-works">See how it works</a>
        </div>

        <div className="lp-hero__install">
          <code>npm install @formpdf/editor</code>
          <button
            className="lp-hero__copy"
            onClick={() => navigator.clipboard.writeText('npm install @formpdf/editor')}
            title="Copy"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="5" width="8" height="8" rx="1.5"/><path d="M3 11V3a1.5 1.5 0 011.5-1.5H11"/></svg>
          </button>
        </div>
      </S>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="lp-flow" id="how-it-works">
      <S><h2 className="lp-section-title">Start visually. Export programmatically.</h2></S>
      <S delay={80}><p className="lp-section-sub">The open-source flow today is editor first, then schema or PDF export.</p></S>

      <div className="lp-flow__steps">
        <S delay={0} className="lp-flow__step">
          <div className="lp-flow__num">1</div>
          <div className="lp-flow__step-body">
            <h3>Place fields with the visual editor</h3>
            <p>Open any PDF. Drag text, signature, date, checkbox, dropdown, or initials fields exactly where they belong. Keyboard shortcuts, undo/redo, alignment guides.</p>
            <div className="lp-flow__code">
<SyntaxPre code={`import { PdfFormEditor } from '@formpdf/editor'
import '@formpdf/editor/styles.css'

<PdfFormEditor
  pdfUrl="/contract.pdf"
  onSave={(bytes) => upload(bytes)}
/>`} />
            </div>
          </div>
        </S>

        <div className="lp-flow__connector" aria-hidden="true">
          <svg width="2" height="60" viewBox="0 0 2 60"><line x1="1" y1="0" x2="1" y2="60" stroke="var(--c-border)" strokeWidth="2" strokeDasharray="4 4"/></svg>
        </div>

        <S delay={120} className="lp-flow__step">
          <div className="lp-flow__num">2</div>
          <div className="lp-flow__step-body">
            <h3>Export JSON schema or filled PDFs</h3>
            <p>Use the same package to export field schemas as JSON or inject AcroForm fields into your PDF. That gives you a clear path from editor testing to app integration.</p>
            <div className="lp-flow__code">
<SyntaxPre code={`import { useFormExport } from '@formpdf/editor'

const { exportJSON, exportToPdf } = useFormExport()

// JSON schema with all field positions
const schema = exportJSON()

// PDF with AcroForm fields baked in
const pdfBytes = await exportToPdf(originalFile)`} />
            </div>
          </div>
        </S>

        <div className="lp-flow__connector" aria-hidden="true">
          <svg width="2" height="60" viewBox="0 0 2 60"><line x1="1" y1="0" x2="1" y2="60" stroke="var(--c-border)" strokeWidth="2" strokeDasharray="4 4"/></svg>
        </div>

        <S delay={240} className="lp-flow__step">
          <div className="lp-flow__num lp-flow__num--soon">3</div>
          <div className="lp-flow__step-body">
            <h3>AI assistance and headless fill <span className="lp-badge-soon">Planned</span></h3>
            <p>We are exploring AI-assisted detection and a headless fill SDK. Those are roadmap items, not part of the zero-config open-source flow today.</p>
            <div className="lp-flow__code lp-flow__code--muted">
<SyntaxPre code={`// Planned API example — not shipped yet
// Headless fill SDK naming and API may change
const pdf = await fillPdf({
  pdf: './lease-template.pdf',
  schema: './lease-schema.json',
  values: {
    tenant_name: 'Sarah Connor',
    monthly_rent: '$2,400',
  }
})`} />
            </div>
          </div>
        </S>
      </div>
    </section>
  )
}

function EditorPreview() {
  const nav = useNavigate()
  return (
    <section className="lp-preview">
      <S>
        <div className="lp-preview__window">
          <div className="lp-preview__chrome">
            <span className="lp-preview__dot" style={{ background: '#ff5f57' }} />
            <span className="lp-preview__dot" style={{ background: '#febc2e' }} />
            <span className="lp-preview__dot" style={{ background: '#28c840' }} />
            <span className="lp-preview__tab">contract.pdf — Formbase</span>
          </div>
          <div className="lp-preview__body">
            <div className="lp-preview__sidebar">
              <div className="lp-preview__sidebar-h">Fields</div>
              {[
                { name: 'Text', color: '#e8793b' },
                { name: 'Signature', color: '#7c68ee' },
                { name: 'Date', color: '#3bb2e8' },
                { name: 'Checkbox', color: '#5a9a63' },
                { name: 'Dropdown', color: '#c586c0' },
                { name: 'Initials', color: '#c8a62c' },
              ].map(f => (
                <div key={f.name} className="lp-preview__field-row">
                  <span className="lp-preview__field-chip" style={{ background: f.color }} />
                  {f.name}
                </div>
              ))}
            </div>
            <div className="lp-preview__canvas">
              <div className="lp-preview__page">
                <div className="lp-preview__line" style={{ width: '72%' }} />
                <div className="lp-preview__line" style={{ width: '88%' }} />
                <div className="lp-preview__line" style={{ width: '54%' }} />
                <div className="lp-preview__placed" data-type="text">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><line x1="5" y1="8" x2="11" y2="8"/></svg>
                  Full Name
                </div>
                <div className="lp-preview__line" style={{ width: '90%' }} />
                <div className="lp-preview__line" style={{ width: '60%' }} />
                <div className="lp-preview__placed" data-type="sig">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12C5 8 8 4 13 3"/></svg>
                  Signature
                </div>
                <div className="lp-preview__line" style={{ width: '45%' }} />
              </div>
            </div>
            <div className="lp-preview__inspector">
              <div className="lp-preview__sidebar-h">Inspector</div>
              {[
                ['Type', 'text'],
                ['Label', 'Full Name'],
                ['Page', '1'],
                ['X', '72.0 pt'],
                ['Y', '680.5 pt'],
                ['Required', 'true'],
              ].map(([k, v]) => (
                <div key={k} className="lp-preview__prop">
                  <span>{k}</span><span>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </S>
      <S delay={100}>
        <button className="lp-btn lp-btn--primary lp-preview__cta" onClick={() => nav('/editor')}>
          Open the real editor
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
        </button>
      </S>
    </section>
  )
}

const FEATURES = [
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="13" y2="14"/></svg>,
    title: '6 Field Types',
    desc: 'Text, signature, initials, date, checkbox, and dropdown. Each with PDF-native sizing defaults.',
    color: '#e8793b',
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 3v4a1 1 0 001 1h4"/><path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>,
    title: 'AcroForm Export',
    desc: 'Export real fillable PDF form fields. Text inputs, checkboxes, dropdowns — all AcroForm compliant.',
    color: '#5a9a63',
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 3v18M16 3v18M3 8h18M3 16h18"/></svg>,
    title: 'PDF-Native Coords',
    desc: 'Fields stored in PDF points. CoordEngine handles Y-flip between PDF and screen space transparently.',
    color: '#3bb2e8',
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="11 7 6 12 11 17"/><polyline points="17 7 12 12 17 17"/></svg>,
    title: 'Composable API',
    desc: 'Use the full editor or import pieces: CoordEngine, field store, individual components. Your layout, your rules.',
    color: '#c586c0',
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
    title: 'Zero Lock-in',
    desc: 'MIT licensed. No API keys required for the base editor flow. No server dependency for local editing or export.',
    color: '#c8a62c',
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/></svg>,
    title: 'AI-Assisted Detection',
    desc: 'Planned and experimental. Requires your own proxy if you want to explore it.',
    color: '#7c68ee',
    soon: true,
  },
]

function Features() {
  return (
    <section className="lp-features" id="features">
      <S><h2 className="lp-section-title">Built for developers</h2></S>
      <S delay={80}><p className="lp-section-sub">What works today for the editor package, plus the roadmap areas we are still exploring.</p></S>
      <div className="lp-features__grid">
        {FEATURES.map((f, i) => (
          <S key={f.title} delay={i * 60} className="lp-features__card">
            <div className="lp-features__icon" style={{ color: f.color, background: `${f.color}12` }}>
              {f.icon}
            </div>
            <h3>{f.title} {'soon' in f && (f as any).soon && <span className="lp-badge-soon">Soon</span>}</h3>
            <p>{f.desc}</p>
          </S>
        ))}
      </div>
    </section>
  )
}

const TABS = [
  {
    label: 'Export Schema',
    code: `import { useFormExport } from '@formpdf/editor'

function ExportButtons({ originalFile }) {
  const { exportJSON, downloadPdf } = useFormExport()

  return (
    <>
      <button onClick={() => {
        const schema = exportJSON()
        // → { version: "2.0", pages, fields }
        saveToServer(schema)
      }}>
        Export JSON Schema
      </button>
      <button onClick={() => downloadPdf(originalFile)}>
        Export Filled PDF
      </button>
    </>
  )
}`,
  },
  {
    label: 'Full Editor',
    code: `import { PdfFormEditor } from '@formpdf/editor'
import '@formpdf/editor/styles.css'

export default function App() {
  return (
    <PdfFormEditor
      pdfUrl="/contract.pdf"
      onSave={(bytes) => upload(bytes)}
    />
  )
}`,
  },
  {
    label: 'Custom Layout',
    code: `import {
  EditorProvider, PdfCanvas, FieldLayer
} from '@formpdf/editor'

function CustomEditor({ file, zoom }) {
  return (
    <EditorProvider>
      <YourToolbar />
      <PdfCanvas pdfFile={file} scale={zoom}>
        {(pageIdx) => <FieldLayer pageIdx={pageIdx} />}
      </PdfCanvas>
      <YourInspector />
    </EditorProvider>
  )
}`,
  },
  {
    label: 'Headless Fill (Planned)',
    code: `// Planned API example — not shipped yet
// SDK name and API may change
const completed = await fillPdf({
  pdf: readFileSync('./lease-template.pdf'),
  schema: readFileSync('./lease-schema.json'),
  values: {
    tenant_name: 'Sarah Connor',
    monthly_rent: '$2,400',
    start_date: 'July 1, 2026',
  }
})

writeFileSync('lease-filled.pdf', completed)`,
  },
]

function CodeSection() {
  const [active, setActive] = useState(0)

  return (
    <section className="lp-code" id="api">
      <S><h2 className="lp-section-title">Use it your way</h2></S>
      <S delay={80}><p className="lp-section-sub">Start with the full editor, export what you need, then compose your own layout when the defaults stop being enough.</p></S>
      <S delay={160}>
        <div className="lp-code__window">
          <div className="lp-code__tabs">
            {TABS.map((t, i) => (
              <button
                key={t.label}
                className={`lp-code__tab ${i === active ? 'lp-code__tab--active' : ''}`}
                onClick={() => setActive(i)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="lp-code__body">
            <SyntaxPre code={TABS[active].code} />
          </div>
        </div>
      </S>
    </section>
  )
}

function Cta() {
  const nav = useNavigate()
  return (
    <section className="lp-cta">
      <S>
        <div className="lp-cta__box">
          <div className="lp-cta__glow" aria-hidden="true" />
          <h2>MIT Licensed. Free forever.</h2>
          <p>Use the editor locally, export schemas or PDFs, and adopt the package at your own pace.</p>
          <div className="lp-cta__actions">
            <button className="lp-btn lp-btn--white" onClick={() => nav('/editor')}>
              Open Editor
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
            </button>
            <a className="lp-btn lp-btn--outline" href="https://github.com/bugenzi/formbase" target="_blank" rel="noopener noreferrer">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              Star on GitHub
            </a>
          </div>
        </div>
      </S>
    </section>
  )
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer__inner">
        <span className="lp-footer__brand">
          <span className="lp-footer__logo-icon">F</span>
          formbase
        </span>
        <div className="lp-footer__links">
          <a href="#features">Features</a>
          <a href="#api">API</a>
          <a href="https://github.com/bugenzi/formbase" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
        <span className="lp-footer__copy">MIT License &middot; {new Date().getFullYear()}</span>
      </div>
    </footer>
  )
}

export default function LandingRoute() {
  return (
    <div className="lp">
      <Nav />
      <Hero />
      <HowItWorks />
      <EditorPreview />
      <Features />
      <CodeSection />
      <Cta />
      <Footer />
    </div>
  )
}
