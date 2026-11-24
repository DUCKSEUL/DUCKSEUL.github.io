import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header.jsx'
import Home from './pages/Home.jsx'
import Journal from './pages/Journal.jsx'
import NotFound from './pages/NotFound.jsx'
import { profile } from './data/profile.js'

// 글 상세 페이지는 수식(KaTeX)·마크다운 렌더러가 무거워 필요할 때만 불러옵니다.
const JournalPost = lazy(() => import('./pages/JournalPost.jsx'))

function ScrollManager() {
  const { pathname, hash, key } = useLocation()
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    const id = decodeURIComponent(hash.slice(1))
    let tries = 0
    let raf
    const tick = () => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView()
      else if (tries++ < 30) raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [pathname, hash, key])
  return null
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <Header />
      <main>
        <Suspense fallback={<div className="page" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/journal/:slug" element={<JournalPost />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <strong>{profile.name}</strong>
          <span>Computational Electromagnetics · Research & Portfolio</span>
          <span className="copy">
            © {new Date().getFullYear()} {profile.name}. Built with Vite + React.
          </span>
        </div>
      </footer>
    </>
  )
}
