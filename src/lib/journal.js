// src/journal/*.md 파일을 빌드 시점에 모두 읽어 연구 일지 목록을 만듭니다.
// 파일명이 '_'로 시작하면(예: _template.md) 무시합니다.
const files = import.meta.glob('../journal/*.md', { query: '?raw', import: 'default', eager: true })

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { meta: {}, body: raw }
  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const key = line.slice(0, i).trim()
    let value = line.slice(i + 1).trim()
    const unquote = (s) => s.replace(/^['"]|['"]$/g, '')
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => unquote(s.trim()))
        .filter(Boolean)
    } else {
      value = unquote(value)
    }
    meta[key] = value
  }
  return { meta, body: m[2] }
}

export const posts = Object.entries(files)
  .filter(([path]) => !path.split('/').pop().startsWith('_'))
  .map(([path, raw]) => {
    const slug = path.split('/').pop().replace(/\.md$/, '')
    const { meta, body } = parseFrontmatter(raw)
    const tags = Array.isArray(meta.tags) ? meta.tags : meta.tags ? [meta.tags] : []
    return {
      slug,
      title: meta.title || slug,
      date: String(meta.date || ''),
      tags,
      summary: meta.summary || '',
      draft: String(meta.draft) === 'true',
      body,
      minutes: Math.max(1, Math.round(body.replace(/\s+/g, '').length / 500)),
    }
  })
  .filter((p) => !p.draft)
  .sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug))

export const allTags = [...new Set(posts.flatMap((p) => p.tags))]

export const getPost = (slug) => posts.find((p) => p.slug === slug)

export function formatDate(d) {
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return d
  return `${y}년 ${Number(m)}월 ${Number(day)}일`
}
