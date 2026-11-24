import { useState } from 'react'
import { Reveal, useDocumentTitle } from '../components/ui.jsx'
import PostCard from '../components/PostCard.jsx'
import { posts, allTags } from '../lib/journal.js'
import { profile } from '../data/profile.js'

const ALL = '전체'

export default function Journal() {
  useDocumentTitle(`연구 일지 · ${profile.name}`)
  const [tag, setTag] = useState(ALL)
  const list = tag === ALL ? posts : posts.filter((p) => p.tags.includes(tag))

  return (
    <section className="page">
      <div className="container narrow">
        <Reveal as="p" className="eyebrow">
          연구 일지
        </Reveal>
        <Reveal as="h1" className="page-title" delay={60}>
          오늘의 연구를
          <br />
          기록합니다
        </Reveal>
        <Reveal as="p" className="page-sub" delay={120}>
          실험 결과, 시행착오, 읽은 논문, 떠오른 아이디어를 남겨요. 지금까지 {posts.length}편을 썼어요.
        </Reveal>

        {allTags.length > 0 && (
          <Reveal className="tag-filter" delay={160} role="group" aria-label="태그 필터">
            {[ALL, ...allTags].map((t) => (
              <button key={t} className={t === tag ? 'is-active' : ''} aria-pressed={t === tag} onClick={() => setTag(t)}>
                {t}
              </button>
            ))}
          </Reveal>
        )}

        {list.length > 0 ? (
          <div className="post-list">
            {list.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        ) : (
          <p className="empty">해당 태그의 일지가 아직 없어요.</p>
        )}
      </div>
    </section>
  )
}
