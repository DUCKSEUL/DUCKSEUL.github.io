import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { marked } from 'marked'

const SEP = '<!-- ===== next post ===== -->'

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const stamp = () => new Date().toISOString().slice(0, 10)
const strip = ({ source, ...p }) => p // eslint-disable-line no-unused-vars

/* ── JSON ───────────────────────────────── */
export function exportJSON(posts) {
  const data = { version: 1, exportedAt: new Date().toISOString(), posts: posts.map(strip) }
  download(`research-journal-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json')
}

/** 저장소에 커밋해 공개할 때 쓰는 형식 (src/data/journal.json) */
export function exportPublishJSON(posts) {
  const list = posts.filter((p) => !p.draft).map(strip)
  download('journal.json', JSON.stringify(list, null, 2), 'application/json')
}

/* ── Markdown ───────────────────────────── */
function turndown() {
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' })
  td.use(gfm)
  td.addRule('mathInline', {
    filter: (n) => n.nodeName === 'SPAN' && n.getAttribute('data-type') === 'math-inline',
    replacement: (_, n) => `$${n.getAttribute('data-latex')}$`,
  })
  td.addRule('mathBlock', {
    filter: (n) => n.nodeName === 'DIV' && n.getAttribute('data-type') === 'math-block',
    replacement: (_, n) => `\n\n$$\n${n.getAttribute('data-latex')}\n$$\n\n`,
  })
  return td
}

export function exportMarkdown(posts) {
  const td = turndown()
  const out = posts.map((p) => {
    const fm = [
      '---',
      `id: ${p.id}`,
      `title: ${JSON.stringify(p.title)}`,
      `category: ${JSON.stringify(p.category || '')}`,
      `tags: ${JSON.stringify(p.tags || [])}`,
      `createdAt: ${p.createdAt}`,
      `updatedAt: ${p.updatedAt || p.createdAt}`,
      `draft: ${!!p.draft}`,
      '---',
    ].join('\n')
    return `${fm}\n\n${td.turndown(p.html)}\n`
  })
  download(`research-journal-${stamp()}.md`, out.join(`\n${SEP}\n\n`), 'text/markdown')
}

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function mdToHtml(md) {
  const maths = []
  let s = md.replace(/\$\$([\s\S]+?)\$\$/g, (_, l) => {
    maths.push({ l: l.trim(), b: true })
    return `\n\nMATHBLOCK${maths.length - 1}END\n\n`
  })
  s = s.replace(/(?<![\\$])\$([^$\n]+?)\$/g, (_, l) => {
    maths.push({ l, b: false })
    return `MATHINLINE${maths.length - 1}END`
  })
  let html = marked.parse(s, { gfm: true })
  const block = (i) => `<div data-type="math-block" data-latex="${escAttr(maths[i].l)}">${escAttr(maths[i].l)}</div>`
  const inline = (i) => `<span data-type="math-inline" data-latex="${escAttr(maths[i].l)}">${escAttr(maths[i].l)}</span>`
  html = html
    .replace(/<p>MATHBLOCK(\d+)END<\/p>/g, (_, i) => block(+i))
    .replace(/MATHBLOCK(\d+)END/g, (_, i) => block(+i))
    .replace(/MATHINLINE(\d+)END/g, (_, i) => inline(+i))
  return html
}

function parseFrontmatter(chunk) {
  const m = chunk.match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { meta: {}, body: chunk }
  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const k = line.slice(0, i).trim()
    const v = line.slice(i + 1).trim()
    try {
      meta[k] = /^["[]|^(true|false)$/.test(v) ? JSON.parse(v) : v
    } catch {
      meta[k] = v
    }
  }
  return { meta, body: m[2] }
}

/* ── Import ─────────────────────────────── */
export async function readImportFile(file) {
  const text = await file.text()
  if (file.name.toLowerCase().endsWith('.json')) {
    const data = JSON.parse(text)
    const list = Array.isArray(data) ? data : data.posts
    if (!Array.isArray(list)) throw new Error('JSON 형식이 올바르지 않아요.')
    return list
  }
  // Markdown: 여러 글은 구분선으로 나뉘어 있음
  return text
    .split(SEP)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((chunk) => {
      const { meta, body } = parseFrontmatter(chunk)
      let title = meta.title
      let md = body
      if (!title) {
        const h = md.match(/^#\s+(.+)$/m)
        title = h ? h[1].trim() : file.name.replace(/\.md$/i, '')
        if (h) md = md.replace(h[0], '')
      }
      return {
        id: meta.id,
        title,
        category: meta.category || '연구 노트',
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        draft: meta.draft === true,
        html: mdToHtml(md.trim()),
      }
    })
}
