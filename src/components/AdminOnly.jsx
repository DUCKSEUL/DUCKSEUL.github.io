import { useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLogin from './AdminLogin.jsx'
import { useDocumentTitle } from './ui.jsx'

export default function AdminOnly() {
  useDocumentTitle('관리자 전용 · 연구 일지')
  const [open, setOpen] = useState(false)
  return (
    <section className="page">
      <div className="admin-gate">
        <h1 className="page-title">관리자 전용 페이지</h1>
        <p>글쓰기와 수정은 관리자만 할 수 있어요.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn btn-md btn-ghost" to="/journal">
            연구 일지 보기
          </Link>
          <button className="btn btn-md btn-primary" onClick={() => setOpen(true)}>
            관리자 로그인
          </button>
        </div>
      </div>
      <AdminLogin open={open} onClose={() => setOpen(false)} />
    </section>
  )
}
