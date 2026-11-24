import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Icon, toast } from './ui.jsx'
import { profile } from '../data/profile.js'
import { useAdmin, logout, clearLoginMessages } from '../lib/admin.js'
import AdminLogin from './AdminLogin.jsx'

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
  const { isAdmin, user, error, notice } = useAdmin()
  useEffect(() => {
    if (!error && !notice) return
    if (error) toast(`GitHub 로그인 실패: ${error}`, 'error')
    else toast(notice)
    clearLoginMessages()
  }, [error, notice])
  const [loginOpen, setLoginOpen] = useState(false)
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
        <Link to="/" className="logo">
          <span className="logo-mark">
            <Icon name="wave" size={16} />
          </span>
          <span className="logo-text">{profile.name}</span>
        </Link>
        <nav className="nav" aria-label="주요 메뉴">
          <NavLink to="/" end>
            <Icon name="home" size={18} />
            <span>홈</span>
          </NavLink>
          <NavLink to="/journal">
            <Icon name="book" size={18} />
            <span>연구 일지</span>
          </NavLink>
        </nav>
        <div className="header-actions">
          <button className="icon-btn" onClick={toggle} aria-label="테마 전환">
            <Icon name={isDark ? 'sun' : 'moon'} size={20} />
          </button>
          {isAdmin ? (
            <>
              <Link className="btn btn-sm btn-primary" to="/write">
                <Icon name="pen" size={16} />
                <span className="hide-sm">글쓰기</span>
              </Link>
              <button
                className="admin-chip is-on"
                onClick={() => {
                  if (window.confirm('관리자 모드에서 로그아웃할까요? 저장된 토큰이 이 브라우저에서 삭제돼요.')) logout()
                }}
                title={`${user?.login} · 클릭하면 로그아웃`}
                aria-label="관리자 로그아웃"
              >
                {user?.avatar ? <img src={user.avatar} alt="" /> : <span className="admin-dot" />}
                <span className="hide-sm">Admin</span>
              </button>
            </>
          ) : (
            <button className="admin-chip" onClick={() => setLoginOpen(true)} aria-label="관리자 로그인">
              Admin
            </button>
          )}
        </div>
      </div>
      <AdminLogin open={loginOpen} onClose={() => setLoginOpen(false)} />
    </header>
  )
}
