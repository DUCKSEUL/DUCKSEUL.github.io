import { useEffect, useState } from 'react'
import { profile, stats, research, projects, skills, timeline } from './data/profile.js'

const NAV = [
  { id: 'about', label: 'About' },
  { id: 'research', label: 'Research' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
  { id: 'contact', label: 'Contact' },
]

function Icon({ name, size = 22 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }
  switch (name) {
    case 'wave':
      return (
        <svg {...common}>
          <path d="M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 3.5-4 5-2" />
          <path d="M2 18c2.5-3 5-3 7.5 0s5 3 7.5 0" opacity=".5" />
        </svg>
      )
    case 'antenna':
      return (
        <svg {...common}>
          <path d="M12 12v9" />
          <circle cx="12" cy="10" r="2" />
          <path d="M7.8 5.8a6 6 0 0 0 0 8.4M16.2 5.8a6 6 0 0 1 0 8.4" />
          <path d="M4.9 2.9a10 10 0 0 0 0 14.2M19.1 2.9a10 10 0 0 1 0 14.2" opacity=".5" />
        </svg>
      )
    case 'spark':
      return (
        <svg {...common}>
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
          <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
        </svg>
      )
    case 'github':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z" />
        </svg>
      )
    case 'arrow':
      return (
        <svg {...common} width={16} height={16}>
          <path d="M7 17L17 7M9 7h8v8" />
        </svg>
      )
    case 'sun':
      return (
        <svg {...common} width={18} height={18}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )
    case 'moon':
      return (
        <svg {...common} width={18} height={18}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )
    case 'menu':
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      )
    default:
      return null
  }
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || null
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
      /* storage unavailable */
    }
  }, [theme])
  const isDark =
    theme === 'dark' ||
    (!theme && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  return [isDark, () => setTheme(isDark ? 'light' : 'dark')]
}

function Header() {
  const [isDark, toggle] = useTheme()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
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
      <div className="hero-bg" aria-hidden>
        <svg viewBox="0 0 1200 400" preserveAspectRatio="none">
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M0 ${200 + i * 14} C 200 ${80 + i * 20}, 400 ${320 - i * 10}, 600 ${200 + i * 6} S 1000 ${90 + i * 18}, 1200 ${200 + i * 10}`}
              style={{ animationDelay: `${i * -1.6}s` }}
            />
          ))}
        </svg>
      </div>
      <div className="container hero-inner">
        <p className="eyebrow">
          <span className="dot" /> {profile.role}
        </p>
        <h1>
          안녕하세요, <span className="grad">{profile.name}</span>입니다.
        </h1>
        <p className="lead">{profile.tagline}</p>
        <div className="hero-cta">
          <a className="btn btn-primary" href="#projects">
            프로젝트 보기
          </a>
          <a className="btn btn-ghost" href={profile.github} target="_blank" rel="noreferrer">
            <Icon name="github" size={18} /> GitHub
          </a>
        </div>
        <dl className="stats">
          {stats.map((s) => (
            <div key={s.label}>
              <dt>{s.value}</dt>
              <dd>{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function SectionHead({ kicker, title, sub }) {
  return (
    <div className="section-head">
      <span className="kicker">{kicker}</span>
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
    </div>
  )
}

function About() {
  return (
    <section className="section" id="about">
      <div className="container about">
        <SectionHead kicker="01 · About" title="연구자 소개" />
        <div className="about-grid">
          <p className="about-text">{profile.intro}</p>
          <ol className="timeline">
            {timeline.map((t) => (
              <li key={t.title}>
                <span className="t-period">{t.period}</span>
                <div>
                  <strong>{t.title}</strong>
                  <span>{t.detail}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

function Research() {
  return (
    <section className="section alt" id="research">
      <div className="container">
        <SectionHead kicker="02 · Research" title="연구 분야" sub="수치해석과 전자기 이론, 그리고 이를 돕는 도구들에 관심이 있습니다." />
        <div className="cards three">
          {research.map((r) => (
            <article className="card" key={r.title}>
              <div className="card-icon">
                <Icon name={r.icon} />
              </div>
              <h3>{r.title}</h3>
              <p>{r.body}</p>
              <ul className="tags">
                {r.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Projects() {
  return (
    <section className="section" id="projects">
      <div className="container">
        <SectionHead kicker="03 · Projects" title="프로젝트" sub="GitHub에 공개된 연구 및 학습 저장소입니다." />
        <div className="cards two">
          {projects.map((p) => (
            <a
              className="card project"
              key={p.repo}
              href={`${profile.github}/${p.repo}`}
              target="_blank"
              rel="noreferrer"
            >
              <div className="project-top">
                <span className="lang">{p.lang}</span>
                <span className="year">{p.year}</span>
              </div>
              <h3>
                {p.title} <Icon name="arrow" />
              </h3>
              <p>{p.description}</p>
              <code className="repo">
                {profile.githubHandle}/{p.repo}
              </code>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function Skills() {
  return (
    <section className="section alt" id="skills">
      <div className="container">
        <SectionHead kicker="04 · Skills" title="기술 스택" />
        <div className="skills">
          {skills.map((g) => (
            <div className="skill-group" key={g.group}>
              <h3>{g.group}</h3>
              <ul className="tags lg">
                {g.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Contact() {
  return (
    <section className="section" id="contact">
      <div className="container">
        <div className="contact">
          <span className="kicker">05 · Contact</span>
          <h2>함께 이야기 나눠요</h2>
          <p>연구 협업, 코드에 대한 질문, 혹은 가벼운 대화도 환영합니다.</p>
          <a className="btn btn-primary" href={profile.github} target="_blank" rel="noreferrer">
            <Icon name="github" size={18} /> github.com/{profile.githubHandle}
          </a>
        </div>
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
        <div className="container">
          © {new Date().getFullYear()} {profile.name} · Built with Vite + React
        </div>
      </footer>
    </>
  )
}
