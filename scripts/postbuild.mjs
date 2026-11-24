// 빌드 후 처리: GitHub Pages에서 새로고침/직접 접속 시 404가 나지 않도록
// 각 경로에 실제 index.html을 만들고, 글마다 제목·요약 메타 태그를 넣습니다.
import fs from 'node:fs'
import path from 'node:path'

const dist = 'dist'
const journalDir = 'src/journal'
const SITE = 'https://duckseul.github.io'
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function meta(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const out = {}
  if (!m) return out
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
  }
  return out
}

function page(route, title, description) {
  let html = template.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
  if (description) {
    html = html.replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(description)}" />`)
  }
  const og = [
    `<meta property="og:title" content="${esc(title)}" />`,
    description && `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${SITE}${route}" />`,
    `<meta property="og:type" content="${route.startsWith('/journal/') ? 'article' : 'website'}" />`,
  ]
    .filter(Boolean)
    .join('\n    ')
  html = html.replace('</head>', `    ${og}\n  </head>`)
  const dir = path.join(dist, route)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), html)
}

// 존재하지 않는 경로용
fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'))

page('/journal/', '연구 일지 · DUCKSEUL', '실험 결과, 시행착오, 읽은 논문, 떠오른 아이디어를 기록하는 연구 일지')

let count = 0
for (const file of fs.readdirSync(journalDir)) {
  if (!file.endsWith('.md') || file.startsWith('_')) continue
  const m = meta(fs.readFileSync(path.join(journalDir, file), 'utf8'))
  if (m.draft === 'true') continue
  const slug = file.replace(/\.md$/, '')
  page(`/journal/${slug}/`, `${m.title || slug} · 연구 일지`, m.summary)
  count++
}
console.log(`postbuild: 404.html + /journal + ${count} post page(s)`)
