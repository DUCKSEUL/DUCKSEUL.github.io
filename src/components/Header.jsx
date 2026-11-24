import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from './ui.jsx'
import { profile } from '../data/profile.js'

const SECTIONS = [
  { id: 'about', label: '소개' },
  { id: 'research', label: '연구' },
  { id: 'projects', label: '프로젝트' },
]

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

export default function Header() {
  const [isDark, toggle] = useTheme()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const inJournal = pathname.startsWith('/journal')

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  useEffect(() => setOpen(false), [pathname])

  return (
    <header className={`header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="container header-inner">
        <Link to="/" className="logo">
          <span className="logo-mark">
            <Icon name="wave" size={16} />
          </span>
          {profile.name}
        </Link>
        <nav className={`nav ${open ? 'is-open' : ''}`} aria-label="주요 메뉴">
          {SECTIONS.map((s) => (
            <Link key={s.id} to={{ pathname: '/', hash: `#${s.id}` }} onClick={() => setOpen(false)}>
              {s.label}
            </Link>
          ))}
          <Link to="/journal" className={inJournal ? 'is-active' : ''} onClick={() => setOpen(false)}>
            연구 일지
          </Link>
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
