import { Link } from 'react-router-dom'
import { Icon, Reveal, useDocumentTitle } from '../components/ui.jsx'
import PostCard from '../components/PostCard.jsx'
import { posts } from '../lib/journal.js'
import { profile, stats, research, projects, skills, timeline } from '../data/profile.js'

const LANG_STYLE = {
  MATLAB: { icon: 'wave', tone: 'blue' },
  Research: { icon: 'antenna', tone: 'purple' },
  Python: { icon: 'code', tone: 'green' },
  Web: { icon: 'globe', tone: 'orange' },
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
          <Link className="btn btn-lg btn-weak" to="/journal">
            <Icon name="pen" size={20} /> 연구 일지
          </Link>
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

function JournalPreview() {
  const latest = posts.slice(0, 3)
  return (
    <section className="section grey" id="journal">
      <div className="container narrow">
        <SectionTitle eyebrow="연구 일지" sub="실험, 시행착오, 읽은 논문, 떠오른 아이디어를 꾸준히 기록해요.">
          매일의 연구를
          <br />
          남겨두고 있어요
        </SectionTitle>
        {latest.length > 0 ? (
          <div className="post-list on-grey">
            {latest.map((p, i) => (
              <Reveal key={p.slug} delay={i * 80}>
                <PostCard post={p} />
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal as="p" className="empty">
            아직 작성된 일지가 없어요.
          </Reveal>
        )}
        <Reveal className="center-cta">
          <Link className="btn btn-lg btn-weak" to="/journal">
            연구 일지 전체 보기 <Icon name="chevron" size={18} />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

function Skills() {
  return (
    <section className="section" id="skills">
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
    <section className="section grey cta-section" id="contact">
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

export default function Home() {
  useDocumentTitle(`${profile.name} · Research & Portfolio`)
  return (
    <>
      <Hero />
      <About />
      <Research />
      <Projects />
      <JournalPreview />
      <Skills />
      <Contact />
    </>
  )
}
