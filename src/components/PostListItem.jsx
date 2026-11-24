import { Link } from 'react-router-dom'
import { formatDateTime, postText, postThumb } from '../lib/store.js'

export default function PostListItem({ post }) {
  const thumb = postThumb(post.html)
  const summary = postText(post.html)
  return (
    <Link to={`/journal/${post.id}`} className="post-item">
      <div className="post-item-body">
        <p className="post-item-cat">
          <span>{post.category || '연구 노트'}</span>
          {post.draft && <em className="badge warn">임시저장</em>}
          {post.source === 'local' && !post.draft && <em className="badge">이 브라우저에 저장됨</em>}
          {post.source === 'modified' && <em className="badge">로컬 수정본</em>}
        </p>
        <h3>{post.title}</h3>
        {summary && <p className="post-item-sum">{summary}</p>}
        <p className="post-item-meta">
          {formatDateTime(post.createdAt, false)}
          {post.tags?.length > 0 && <span> · {post.tags.map((t) => `#${t}`).join(' ')}</span>}
        </p>
      </div>
      <div className={`post-item-thumb ${thumb ? '' : 'is-empty'}`} aria-hidden>
        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span>{(post.category || '연구')[0]}</span>}
      </div>
    </Link>
  )
}
