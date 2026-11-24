import { Link } from 'react-router-dom'
import { formatDate } from '../lib/journal.js'
import { Icon } from './ui.jsx'

export default function PostCard({ post }) {
  return (
    <Link to={`/journal/${post.slug}`} className="post-card">
      <div className="post-card-body">
        <p className="post-meta">
          {formatDate(post.date)} · {post.minutes}분 분량
        </p>
        <h3>{post.title}</h3>
        {post.summary && <p className="post-summary">{post.summary}</p>}
        {post.tags.length > 0 && (
          <ul className="tags">
            {post.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
      </div>
      <span className="list-chevron">
        <Icon name="chevron" />
      </span>
    </Link>
  )
}
