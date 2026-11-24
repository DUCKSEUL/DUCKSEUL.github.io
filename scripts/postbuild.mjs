// 빌드 후 처리: GitHub Pages에서 새로고침/직접 접속 시 404가 나지 않도록
// 각 경로에 실제 index.html을 만들고, 글마다 제목·요약 메타 태그를 넣습니다.
import fs from 'node:fs'
import path from 'node:path'

const dist = 'dist'
const SITE = 'https://duckseul.github.io'
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const posts = JSON.parse(fs.readFileSync('public/data/posts.json', 'utf8'))

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const text = (html) =>
  html
    .replace(/<(span|div)[^>]*data-type="math-[^"]*"[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<pre[\s\S]*?<\/pre>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function page(route, title, description, image) {
  let html = template.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
  if (description) {
    html = html.replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(description)}" />`)
  }
  const og = [
    `<meta property="og:title" content="${esc(title)}" />`,
    description && `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${SITE}${route}" />`,
    `<meta property="og:type" content="${route.startsWith('/journal/') && route !== '/journal/' ? 'article' : 'website'}" />`,
    image && `<meta property="og:image" content="${image.startsWith('/') ? SITE + image : esc(image)}" />`,
  ]
    .filter(Boolean)
    .join('\n    ')
  html = html.replace('</head>', `    ${og}\n  </head>`)
  const dir = path.join(dist, route)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), html)
}

fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'))
page('/journal/', '연구 일지 · DUCKSEUL', '실험 결과, 시행착오, 읽은 논문, 떠오른 아이디어를 기록하는 연구 일지')
page('/write/', '일지 쓰기 · DUCKSEUL', '연구 일지 작성')

let n = 0
for (const p of posts) {
  if (p.draft) continue
  const img = p.html.match(/<img[^>]+src="([^"]+)"/)?.[1]
  page(`/journal/${p.id}/`, `${p.title} · 연구 일지`, text(p.html).slice(0, 150), img && !img.startsWith('data:') ? img : null)
  n++
}
console.log(`postbuild: 404.html + /journal + /write + ${n} post page(s)`)
