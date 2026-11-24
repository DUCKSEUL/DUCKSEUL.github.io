import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../components/ui.jsx'

export default function NotFound() {
  useDocumentTitle('페이지를 찾을 수 없어요')
  return (
    <section className="page not-found">
      <div className="journal-col">
        <p className="eyebrow">404</p>
        <h1 className="page-title">페이지를 찾을 수 없어요</h1>
        <p className="page-sub">주소가 바뀌었거나 삭제된 글이에요.</p>
        <Link className="btn btn-lg btn-primary" to="/">
          홈으로 가기
        </Link>
      </div>
    </section>
  )
}
