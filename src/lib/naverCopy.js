// 렌더링된 일지 본문을 네이버 블로그 에디터에 붙여넣기 좋은 HTML(Rich Text)로 변환해 복사합니다.
// - 모든 서식을 인라인 style로 변환 (클래스/외부 CSS는 붙여넣을 때 사라지므로)
// - 수식은 고해상도 PNG 이미지로 변환
import { toPng } from 'html-to-image'

const FONT = "'Nanum Gothic', '나눔고딕', NanumGothic, sans-serif"
const MONO = 'Consolas, Cousine, monospace'
const TEXT = '#333333'

// KaTeX 폰트만 data URL로 묶어 html-to-image에 직접 전달 (외부 CSS 접근/보안 오류 방지)
let fontCSSPromise
function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(blob)
  })
}
function katexFontCSS() {
  if (!fontCSSPromise) {
    fontCSSPromise = (async () => {
      const rules = []
      for (const sheet of document.styleSheets) {
        let list
        try {
          list = sheet.cssRules
        } catch {
          continue
        }
        for (const r of list) {
          if (r instanceof CSSFontFaceRule && /KaTeX/.test(r.style.getPropertyValue('font-family'))) rules.push(r)
        }
      }
      const parts = await Promise.all(
        rules.map(async (r) => {
          // 첫 번째 url(...) 사용 (Vite가 작은 폰트를 data URL로 인라인한 경우도 처리)
          const m = r.style.getPropertyValue('src').match(/url\(["']?([^"')]+)["']?\)/)
          if (!m) return ''
          try {
            const data = m[1].startsWith('data:')
              ? m[1]
              : await blobToDataUrl(await (await fetch(new URL(m[1], r.parentStyleSheet?.href || location.href).href)).blob())
            const st = r.style
            return `@font-face{font-family:${st.getPropertyValue('font-family')};font-style:${st.getPropertyValue('font-style') || 'normal'};font-weight:${st.getPropertyValue('font-weight') || 'normal'};src:url(${data}) format("woff2");}`
          } catch {
            return ''
          }
        }),
      )
      return parts.join('\n')
    })()
  }
  return fontCSSPromise
}

async function snapshot(node) {
  // 캡처하는 동안만 inline-block으로 바꿔 실제 수식 크기에 맞춤
  // (블록 수식은 내부 요소가 본문 폭 전체로 계산되어 잘리는 문제 방지)
  const inner = node.querySelector('.katex-html')
  const prev = [node.style.display, inner?.style.display]
  node.style.display = 'inline-block'
  if (inner) inner.style.display = 'inline-block'
  try {
    const rect = node.getBoundingClientRect()
    const opts = {
      pixelRatio: 3,
      backgroundColor: '#ffffff',
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
      style: { color: '#111111', margin: '0', padding: '0' },
      fontEmbedCSS: await katexFontCSS(),
    }
    // 첫 렌더가 빈 이미지로 나오는 경우가 있어 재시도
    for (let i = 0; i < 3; i++) {
      const png = await toPng(node, opts)
      if (png.length > 200) return { png, w: opts.width, h: opts.height }
    }
    return null
  } finally {
    node.style.display = prev[0]
    if (inner) inner.style.display = prev[1]
  }
}

async function rasterize(src, width, height) {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = src
  await img.decode()
  const w = Math.round(width * 2)
  const h = Math.round(height * 2)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.fillRect(0, 0, w, h)
  g.drawImage(img, 0, 0, w, h)
  return c.toDataURL('image/png')
}

function addStyle(el, css) {
  const prev = el.getAttribute('style')
  el.setAttribute('style', prev ? `${css};${prev}` : css)
}

function replaceTag(el, tag, css) {
  const n = document.createElement(tag)
  for (const a of el.attributes) n.setAttribute(a.name, a.value)
  n.innerHTML = el.innerHTML
  addStyle(n, css)
  el.replaceWith(n)
  return n
}

async function mathToImages(live, clone) {
  const liveMath = [...live.querySelectorAll('[data-type="math-inline"], [data-type="math-block"]')]
  const cloneMath = [...clone.querySelectorAll('[data-type="math-inline"], [data-type="math-block"]')]
  for (let i = 0; i < liveMath.length; i++) {
    const el = liveMath[i]
    const block = el.getAttribute('data-type') === 'math-block'
    const target = el.querySelector('.katex-html')?.parentElement || el
    if (!target.getBoundingClientRect().width) continue
    const shot = await snapshot(target)
    if (!shot) continue
    const { png } = shot
    const img = document.createElement('img')
    img.src = png
    img.alt = el.getAttribute('data-latex') || ''
    img.setAttribute('data-math', '1')
    const w = shot.w
    const h = shot.h
    img.setAttribute('width', String(w))
    img.setAttribute('height', String(h))
    img.setAttribute('style', `width:${w}px;height:${h}px;vertical-align:middle;border:0`)
    if (block) {
      const p = document.createElement('p')
      p.setAttribute('style', 'text-align:center;margin:16px 0')
      p.appendChild(img)
      cloneMath[i].replaceWith(p)
    } else {
      cloneMath[i].replaceWith(img)
    }
  }
}

export async function buildNaverHtml(container) {
  const clone = container.cloneNode(true)

  // SVG 사진은 네이버 에디터 호환을 위해 PNG로 변환
  const liveImgs = [...container.querySelectorAll('img')]
  const cloneImgs = [...clone.querySelectorAll('img')]
  for (let i = 0; i < liveImgs.length; i++) {
    const src = liveImgs[i].currentSrc || liveImgs[i].src
    if (!/\.svg(\?|$)|^data:image\/svg/i.test(src)) continue
    const r = liveImgs[i].getBoundingClientRect()
    try {
      cloneImgs[i].setAttribute('src', await rasterize(src, r.width, r.height))
    } catch {
      /* 변환 실패 시 원본 유지 */
    }
  }

  await mathToImages(container, clone)

  clone.querySelectorAll('h1, h2').forEach((el) => replaceTag(el, 'p', 'font-size:18pt;font-weight:bold;margin:28px 0 10px;line-height:1.5'))
  clone.querySelectorAll('h3').forEach((el) => replaceTag(el, 'p', 'font-size:15pt;font-weight:bold;margin:24px 0 8px;line-height:1.5'))
  clone.querySelectorAll('h4, h5, h6').forEach((el) => replaceTag(el, 'p', 'font-size:13pt;font-weight:bold;margin:20px 0 6px'))
  clone.querySelectorAll('p').forEach((el) => {
    if (!el.closest('li, td, th, blockquote')) addStyle(el, 'margin:0 0 4px;line-height:1.5')
    else addStyle(el, 'margin:0')
  })
  clone.querySelectorAll('blockquote').forEach((el) =>
    addStyle(el, `margin:18px 0;padding:14px 18px;border-left:4px solid #3182f6;background:#f5f7fa;color:#4e5968`),
  )
  clone.querySelectorAll('pre').forEach((el) =>
    addStyle(
      el,
      `margin:16px 0;padding:14px 16px;background:#f6f8fa;border:1px solid #e5e8eb;border-radius:6px;font-family:${MONO};font-size:10pt;line-height:1.6;white-space:pre-wrap;color:#191f28`,
    ),
  )
  clone.querySelectorAll('code').forEach((el) => {
    if (el.closest('pre')) addStyle(el, `font-family:${MONO}`)
    else addStyle(el, `font-family:${MONO};background:#f2f4f6;padding:1px 5px;border-radius:4px;font-size:0.92em`)
  })
  clone.querySelectorAll('table').forEach((el) => {
    addStyle(el, 'border-collapse:collapse;width:100%;margin:16px 0')
    el.setAttribute('border', '1')
    el.setAttribute('cellpadding', '8')
  })
  clone.querySelectorAll('th').forEach((el) => addStyle(el, 'border:1px solid #d1d6db;padding:8px 12px;background:#f2f4f6;font-weight:bold;text-align:left'))
  clone.querySelectorAll('td').forEach((el) => addStyle(el, 'border:1px solid #d1d6db;padding:8px 12px'))
  const HR = {
    line: 'border:0;border-top:1px solid #d1d6db;margin:28px 0',
    bold: 'border:0;border-top:3px solid #333d4b;margin:28px 0',
    dotted: 'border:0;border-top:2px dotted #b0b8c1;margin:28px 0',
    short: 'border:0;border-top:2px solid #333d4b;width:60px;margin:32px auto',
    double: 'border:0;border-top:4px double #8b95a1;margin:28px 0',
  }
  clone.querySelectorAll('hr').forEach((el) => {
    const v = el.getAttribute('data-style') || 'line'
    if (v === 'dots') {
      const p = document.createElement('p')
      p.setAttribute('style', 'text-align:center;color:#b0b8c1;font-size:14pt;letter-spacing:14px;margin:28px 0')
      p.textContent = '• • •'
      el.replaceWith(p)
    } else {
      el.removeAttribute('data-style')
      el.setAttribute('style', HR[v] || HR.line)
    }
  })
  clone.querySelectorAll('ul, ol').forEach((el) => addStyle(el, 'margin:0 0 14px;padding-left:24px;line-height:1.5'))
  clone.querySelectorAll('a').forEach((el) => addStyle(el, 'color:#3182f6;text-decoration:underline'))

  // 사진(figure): 캡션은 옅은 회색 가운데 정렬, 테두리 옵션 반영
  clone.querySelectorAll('figure').forEach((fig) => {
    const img = fig.querySelector('img')
    if (!img) return fig.remove()
    const pct = parseFloat(fig.style.width)
    const px = Math.round(740 * (Number.isFinite(pct) && fig.style.width.endsWith('%') ? pct / 100 : 1))
    const src = img.getAttribute('src') || ''
    if (src.startsWith('/')) img.setAttribute('src', location.origin + src)
    img.setAttribute('width', String(px))
    img.setAttribute('data-done', '1')
    img.setAttribute(
      'style',
      `width:${px}px;max-width:100%;height:auto;${fig.getAttribute('data-border') === 'true' ? 'border:1px solid #e5e8eb' : 'border:0'}`,
    )
    const p = document.createElement('p')
    p.setAttribute('style', 'text-align:center;margin:16px 0 4px')
    p.appendChild(img)
    const frag = document.createDocumentFragment()
    frag.appendChild(p)
    const cap = fig.querySelector('figcaption')?.textContent?.trim()
    if (cap) {
      const c = document.createElement('p')
      c.setAttribute('style', 'text-align:center;color:#8b95a1;font-size:10pt;margin:4px 0 18px')
      c.textContent = cap
      frag.appendChild(c)
    }
    fig.replaceWith(frag)
  })

  // 본문 사진: 절대 주소 + 가운데 정렬 + px 너비(네이버 본문 폭 약 740px 기준)
  clone.querySelectorAll('img').forEach((img) => {
    if (img.hasAttribute('data-math') || img.hasAttribute('data-done')) return
    const src = img.getAttribute('src') || ''
    if (src.startsWith('/')) img.setAttribute('src', location.origin + src)
    const pct = parseFloat(img.style.width)
    const px = Math.round(740 * (Number.isFinite(pct) && img.style.width.endsWith('%') ? pct / 100 : 1))
    img.removeAttribute('height')
    img.setAttribute('width', String(px))
    const inline = img.getAttribute('data-type') === 'figure' && img.parentElement?.tagName === 'P'
    img.removeAttribute('data-type')
    img.setAttribute('style', `width:${px}px;max-width:100%;height:auto;border:0${inline ? ';display:inline-block;vertical-align:middle;margin:4px 2px' : ''}`)
    if (img.parentElement === clone || img.parentElement?.classList.contains('img-node')) {
      const p = document.createElement('p')
      p.setAttribute('style', 'text-align:center;margin:16px 0')
      img.replaceWith(p)
      p.appendChild(img)
    }
  })

  clone.querySelectorAll('[class]').forEach((el) => el.removeAttribute('class'))
  clone.querySelectorAll('[data-type], [data-latex], [data-math], [data-done], [data-border], [title]').forEach((el) => {
    el.removeAttribute('data-done')
    el.removeAttribute('data-border')
    el.removeAttribute('data-math')
    el.removeAttribute('data-type')
    el.removeAttribute('data-latex')
    el.removeAttribute('title')
  })

  const html = `<div style="font-family:${FONT};font-size:12pt;line-height:1.5;color:${TEXT}">${clone.innerHTML}</div>`
  const text = container.innerText
  return { html, text }
}

export async function copyRichHtml({ html, text }) {
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ])
      return
    } catch {
      /* 아래 대체 방식 사용 */
    }
  }
  const div = document.createElement('div')
  div.contentEditable = 'true'
  div.innerHTML = html
  div.style.cssText = 'position:fixed;left:-99999px;top:0;opacity:0'
  document.body.appendChild(div)
  const range = document.createRange()
  range.selectNodeContents(div)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
  const ok = document.execCommand('copy')
  sel.removeAllRanges()
  div.remove()
  if (!ok) throw new Error('클립보드에 복사하지 못했어요.')
}
