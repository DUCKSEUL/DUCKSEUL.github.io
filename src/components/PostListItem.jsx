import { Link } from 'react-router-dom'
import { Icon } from './ui.jsx'
import { formatDateTime, postText, postThumb } from '../lib/store.js'

export default function PostListItem({ post, onDelete }) {
  const thumb = postThumb(post.html)
  const summary = postText(post.html)
  return (
    <div className={`post-row ${post.source === 'private' ? 'is-private' : ''}`}>
      <Link to={`/journal/${post.id}`} className="post-item">
        <div className="post-item-body">
          <p className="post-item-cat">
            <span>{post.category || '연구 노트'}</span>
            {post.source === 'private' && (
              <em className="lock-badge" title="비공개 저장소에 저장된 글 · 나에게만 보여요">
                🔒 나에게만 보기 (비공개){post.hasPublic && <span> · 공개본 있음</span>}
              </em>
            )}
            {post.draft && post.source !== 'private' && (
              <em className="badge private" title="이 브라우저에만 저장된 글">
                {post.source === 'modified' ? '이 브라우저에만 · 공개본 있음' : '이 브라우저에만 저장'}
              </em>
            )}
            {post.source === 'local' && !post.draft && <em className="badge warn">발행 전</em>}
            {post.source === 'modified' && !post.draft && <em className="badge warn">발행 전 수정본</em>}
            {post.source === 'syncing' && <em className="badge sync">배포 대기</em>}
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
      {onDelete && (
        <button className="post-del" onClick={() => onDelete(post)} aria-label={`「${post.title}」 삭제`} title="삭제">
          <Icon name="trash" size={16} />
        </button>
      )}
    </div>
  )
}
