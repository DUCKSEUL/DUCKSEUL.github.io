import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header.jsx'
import { ToastHost } from './components/ui.jsx'
import Dashboard from './pages/Dashboard.jsx'
import JournalList from './pages/JournalList.jsx'
import JournalPost from './pages/JournalPost.jsx'
import NotFound from './pages/NotFound.jsx'
import { profile } from './data/profile.js'

// 에디터(TipTap)는 무거우므로 글쓰기 화면에 들어갈 때만 불러옵니다.
const Write = lazy(() => import('./pages/Write.jsx'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

export default function App() {
  const location = useLocation()
  const isWrite = location.pathname.startsWith('/write')
  return (
    <>
      <ScrollToTop />
      <Header />
      <main>
        <div key={location.pathname} className="route-fade">
          <Suspense fallback={<div className="page" />}>
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/journal" element={<JournalList />} />
              <Route path="/journal/:id" element={<JournalPost />} />
              <Route path="/write" element={<Write />} />
              <Route path="/write/:id" element={<Write />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </main>
      {!isWrite && (
        <footer className="footer">
          <div className="container footer-inner">
            <strong>{profile.name}</strong>
            <span>© {new Date().getFullYear()} · Built with Vite + React</span>
          </div>
        </footer>
      )}
      <ToastHost />
    </>
  )
}
