import { useEffect, useRef, useState } from 'react'
import { profile, stats, research, projects, skills, timeline } from './data/profile.js'

const NAV = [
  { id: 'about', label: '소개' },
  { id: 'research', label: '연구' },
  { id: 'projects', label: '프로젝트' },
  { id: 'skills', label: '기술' },
]

/* ── Icons ─────────────────────────────────────────────── */
function Icon({ name, size = 24 }) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }
  switch (name) {
    case 'wave':
      return (
        <svg {...p}>
          <path d="M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 3.5-4 5-2" />
        </svg>
      )
    case 'antenna':
      return (
        <svg {...p}>
          <path d="M12 12v9" />
          <circle cx="12" cy="10" r="2" />
          <path d="M7.8 5.8a6 6 0 0 0 0 8.4M16.2 5.8a6 6 0 0 1 0 8.4" />
        </svg>
      )
    case 'spark':
      return (
        <svg {...p}>
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
        </svg>
      )
    case 'code':
      return (
        <svg {...p}>
          <path d="M8 6l-6 6 6 6M16 6l6 6-6 6" />
        </svg>
      )
    case 'book':
      return (
        <svg {...p}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
          <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
        </svg>
      )
    case 'globe':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      )
    case 'chevron':
      return (
        <svg {...p} width={20} height={20}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      )
    case 'github':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z" />
        </svg>
      )
    case 'sun':
      return (
        <svg {...p} width={20} height={20}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )
    case 'moon':
      return (
        <svg {...p} width={20} height={20}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )
    case 'menu':
      return (
        <svg {...p}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      )
    case 'close':
      return (
        <svg {...p}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      )
    default:
      return null
  }
}

const LANG_STYLE = {
  MATLAB: { icon: 'wave', tone: 'blue' },
  Research: { icon: 'antenna', tone: 'purple' },
  Python: { icon: 'code', tone: 'green' },
  Web: { icon: 'globe', tone: 'orange' },
}

/* ── Hooks ─────────────────────────────────────────────── */
function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <Tag
      ref={ref}
      className={`reveal ${shown ? 'in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme')
    } catch {
      return null
    }
  })
  useEffect(() => {
    const root = document.documentElement
    if (theme) root.setAttribute('data-theme', theme)
    else root.removeAttribute('data-theme')
    try {
      if (theme) localStorage.setItem('theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])
  const isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  return [isDark, () => setTheme(isDark ? 'light' : 'dark')]
}

/* ── Sections ──────────────────────────────────────────── */
function Header() {
  const [isDark, toggle] = useTheme()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  return (
    <header className={`header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="container header-inner">
        <a href="#top" className="logo" onClick={() => setOpen(false)}>
          <span className="logo-mark">
            <Icon name="wave" size={16} />
          </span>
          {profile.name}
        </a>
        <nav className={`nav ${open ? 'is-open' : ''}`} aria-label="주요 메뉴">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} onClick={() => setOpen(false)}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <button className="icon-btn" onClick={toggle} aria-label="테마 전환">
            <Icon name={isDark ? 'sun' : 'moon'} />
          </button>
          <a className="btn btn-sm btn-primary header-cta" href={profile.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <button className="icon-btn menu-btn" onClick={() => setOpen((v) => !v)} aria-label="메뉴 열기">
            <Icon name={open ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="container hero-inner">
        <Reveal as="p" className="hero-badge">
          {profile.role}
        </Reveal>
        <Reveal as="h1" delay={80}>
          전자기 문제를
          <br />
          <span className="blue">코드로 풀어내는</span>
          <br />
          연구자, {profile.name}
        </Reveal>
        <Reveal as="p" className="hero-sub" delay={160}>
          {profile.tagline}
        </Reveal>
        <Reveal className="hero-cta" delay={240}>
          <a className="btn btn-lg btn-primary" href="#projects">
            프로젝트 둘러보기
          </a>
          <a className="btn btn-lg btn-weak" href={profile.github} target="_blank" rel="noreferrer">
            <Icon name="github" size={20} /> GitHub
          </a>
        </Reveal>
        <Reveal className="hero-visual" delay={320} aria-hidden>
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="phone">
            <div className="phone-row">
              <span className="chip blue">
                <Icon name="wave" size={18} />
              </span>
              <div>
                <strong>3D IE-MoM Solver</strong>
                <small>수렴 완료 · 잔차 1.2e-6</small>
              </div>
            </div>
            <svg className="phone-chart" viewBox="0 0 300 110" preserveAspectRatio="none">
              <defs>
                <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--blue)" stopOpacity=".28" />
                  <stop offset="1" stopColor="var(--blue)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 80 C 30 20, 60 20, 90 60 S 150 100, 180 50 S 240 10, 300 40 L300 110 L0 110Z"
                fill="url(#g)"
              />
              <path
                d="M0 80 C 30 20, 60 20, 90 60 S 150 100, 180 50 S 240 10, 300 40"
                fill="none"
                stroke="var(--blue)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <div className="phone-grid">
              {stats.map((s) => (
                <div key={s.label}>
                  <b>{s.value}</b>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function SectionTitle({ eyebrow, children, sub }) {
  return (
    <div className="section-title">
      <Reveal as="p" className="eyebrow">
        {eyebrow}
      </Reveal>
      <Reveal as="h2" delay={60}>
        {children}
      </Reveal>
      {sub && (
        <Reveal as="p" className="section-sub" delay={120}>
          {sub}
        </Reveal>
      )}
    </div>
  )
}

function About() {
  return (
    <section className="section" id="about">
      <div className="container narrow">
        <SectionTitle eyebrow="소개">
          수치해석으로
          <br />
          보이지 않는 파동을 그립니다
        </SectionTitle>
        <Reveal as="p" className="about-text">
          {profile.intro}
        </Reveal>
        <div className="timeline">
          {timeline.map((t, i) => (
            <Reveal className="t-item" key={t.title} delay={i * 80}>
              <span className="t-date">{t.period}</span>
              <div>
                <strong>{t.title}</strong>
                <span>{t.detail}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Research() {
  return (
    <section className="section grey" id="research">
      <div className="container">
        <SectionTitle eyebrow="연구" sub="수치해석과 전자기 이론, 그리고 이를 돕는 도구에 관심이 있어요.">
          세 가지 질문을
          <br />
          깊게 파고들어요
        </SectionTitle>
        <div className="research-grid">
          {research.map((r, i) => (
            <Reveal as="article" className="r-card" key={r.title} delay={i * 100}>
              <span className={`chip lg ${['blue', 'purple', 'green'][i % 3]}`}>
                <Icon name={r.icon} size={26} />
              </span>
              <h3>{r.title}</h3>
              <p>{r.body}</p>
              <ul className="tags">
                {r.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Projects() {
  return (
    <section className="section" id="projects">
      <div className="container narrow">
        <SectionTitle eyebrow="프로젝트" sub="GitHub에 공개된 연구 및 학습 저장소예요.">
          직접 만들고
          <br />
          기록한 것들
        </SectionTitle>
        <Reveal className="list">
          {projects.map((p) => {
            const s = LANG_STYLE[p.lang] || { icon: 'book', tone: 'blue' }
            return (
              <a className="list-row" key={p.repo} href={`${profile.github}/${p.repo}`} target="_blank" rel="noreferrer">
                <span className={`chip ${s.tone}`}>
                  <Icon name={s.icon} size={22} />
                </span>
                <div className="list-body">
                  <strong>{p.title}</strong>
                  <span>{p.description}</span>
                </div>
                <span className="list-meta">{p.lang}</span>
                <span className="list-chevron">
                  <Icon name="chevron" />
                </span>
              </a>
            )
          })}
        </Reveal>
      </div>
    </section>
  )
}

function Skills() {
  return (
    <section className="section grey" id="skills">
      <div className="container">
        <SectionTitle eyebrow="기술">
          연구를 움직이는
          <br />
          도구들
        </SectionTitle>
        <div className="skills">
          {skills.map((g, i) => (
            <Reveal className="skill-card" key={g.group} delay={i * 100}>
              <h3>{g.group}</h3>
              <ul className="tags lg">
                {g.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Contact() {
  return (
    <section className="section cta-section" id="contact">
      <div className="container">
        <Reveal as="h2">
          함께 이야기
          <br />
          나눠볼까요?
        </Reveal>
        <Reveal as="p" className="section-sub" delay={80}>
          연구 협업, 코드에 대한 질문, 가벼운 대화 모두 환영해요.
        </Reveal>
        <Reveal delay={160}>
          <a className="btn btn-lg btn-primary" href={profile.github} target="_blank" rel="noreferrer">
            <Icon name="github" size={20} /> github.com/{profile.githubHandle}
          </a>
        </Reveal>
      </div>
    </section>
  )
}

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <About />
        <Research />
        <Projects />
        <Skills />
        <Contact />
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <strong>{profile.name}</strong>
          <span>Computational Electromagnetics · Research & Portfolio</span>
          <span className="copy">© {new Date().getFullYear()} {profile.name}. Built with Vite + React.</span>
        </div>
      </footer>
    </>
  )
}
