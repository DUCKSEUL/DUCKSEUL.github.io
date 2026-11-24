import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Icon, useDocumentTitle } from '../components/ui.jsx'
import { posts, getPost, formatDate } from '../lib/journal.js'
import { profile } from '../data/profile.js'
import NotFound from './NotFound.jsx'

const mdComponents = {
  a: ({ href = '', children, ...rest }) =>
    href.startsWith('/') && !href.startsWith('//') ? (
      <Link to={href}>{children}</Link>
    ) : (
      <a href={href} target={href.startsWith('#') ? undefined : '_blank'} rel="noreferrer" {...rest}>
        {children}
      </a>
    ),
  table: ({ children }) => (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  ),
  img: ({ alt = '', ...rest }) => <img alt={alt} loading="lazy" {...rest} />,
}

export default function JournalPost() {
  const { slug } = useParams()
  const post = getPost(slug)
  useDocumentTitle(post ? `${post.title} · 연구 일지` : `일지를 찾을 수 없어요 · ${profile.name}`)
  if (!post) return <NotFound />

  const idx = posts.indexOf(post)
  const newer = posts[idx - 1]
  const older = posts[idx + 1]

  return (
    <article className="page">
      <div className="container narrow">
        <Link to="/journal" className="back-link">
          <Icon name="chevronLeft" size={18} /> 연구 일지
        </Link>
        <header className="post-head">
          {post.tags.length > 0 && (
            <ul className="tags">
              {post.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          <h1>{post.title}</h1>
          <p className="post-meta">
            {formatDate(post.date)} · {post.minutes}분 분량
          </p>
        </header>

        <div className="prose">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={mdComponents}>
            {post.body}
          </ReactMarkdown>
        </div>

        {(older || newer) && (
          <nav className="post-nav" aria-label="다른 일지">
            {older ? (
              <Link to={`/journal/${older.slug}`} className="post-nav-item">
                <span>이전 일지</span>
                <strong>{older.title}</strong>
              </Link>
            ) : (
              <span />
            )}
            {newer ? (
              <Link to={`/journal/${newer.slug}`} className="post-nav-item next">
                <span>다음 일지</span>
                <strong>{newer.title}</strong>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </article>
  )
}
