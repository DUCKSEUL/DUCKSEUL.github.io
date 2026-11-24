// 붙여넣기(Ctrl+V)/드래그한 이미지를 자동 리사이징·압축해 data URL로 변환합니다.
//  - 가로 최대 1400px (비율 유지, 확대는 하지 않음)
//  - JPEG 품질 0.85. 단, 작은 PNG 캡처는 글자가 선명하도록 PNG를 유지
import DOMPurify from 'dompurify'

export const MAX_W = 1400
export const QUALITY = 0.85
const KEEP_PNG_BYTES = 400_000 // 이보다 작게 나오는 PNG는 그대로 PNG

export const isSvgFile = (f) => f?.type === 'image/svg+xml' || /\.svgz?$/i.test(f?.name || '')
export const isSvgSrc = (src = '') => /^data:image\/svg\+xml/i.test(src) || /^[^?#]+\.svgz?([?#]|$)/i.test(src)

/**
 * SVG 보안 처리: <script>·이벤트 핸들러(on*)·javascript: URL·foreignObject 등을 엄격히 제거한 뒤
 * Canvas로 고해상도 PNG로 래스터화합니다. 결과물은 스크립트가 들어갈 수 없는 순수 비트맵(data:image/png).
 */
export function sanitizeSvgText(text) {
  const clean = DOMPurify.sanitize(String(text || ''), {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'embed', 'object', 'a', 'use', 'animate', 'set', 'animateTransform', 'animateMotion'],
    FORBID_ATTR: ['href', 'xlink:href'],
  })
  if (!/<svg[\s>]/i.test(clean)) throw new Error('올바른 SVG가 아니에요.')
  // 크기 정보가 없으면 viewBox로 채워 래스터 크기를 정확히
  const doc = new DOMParser().parseFromString(clean, 'image/svg+xml')
  const svg = doc.documentElement
  if (svg.nodeName.toLowerCase() !== 'svg') throw new Error('올바른 SVG가 아니에요.')
  if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
  const num = (v) => parseFloat(v) || 0
  if (!num(svg.getAttribute('width')) && vb.length === 4 && vb[2] > 0) svg.setAttribute('width', String(vb[2]))
  if (!num(svg.getAttribute('height')) && vb.length === 4 && vb[3] > 0) svg.setAttribute('height', String(vb[3]))
  return new XMLSerializer().serializeToString(svg)
}

export async function svgToPng(svgText) {
  const safe = sanitizeSvgText(svgText)
  const url = URL.createObjectURL(new Blob([safe], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const nw = img.naturalWidth || 800
    const nh = img.naturalHeight || 600
    // 선명도를 위해 2배로 그리되 가로 최대 MAX_W
    const scale = Math.min(2, MAX_W / nw) || 1
    const w = Math.max(1, Math.round(nw * scale))
    const h = Math.max(1, Math.round(nh * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** data URL 또는 주소의 SVG를 안전한 PNG data URL로 */
export async function svgSrcToPng(src) {
  let text
  if (/^data:image\/svg\+xml/i.test(src)) {
    const [meta, body = ''] = src.split(',', 2)
    text = /;base64/i.test(meta) ? new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0))) : decodeURIComponent(body)
  } else {
    const res = await fetch(src)
    if (!res.ok) throw new Error(`SVG를 불러오지 못했어요 (${res.status})`)
    text = await res.text()
  }
  return svgToPng(text)
}

export async function fileToDataUrl(file) {
  if (isSvgFile(file)) return svgToPng(await file.text())
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_W / bitmap.width)
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  if (file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/webp') {
    const png = canvas.toDataURL('image/png')
    if (png.length * 0.75 < KEEP_PNG_BYTES) return png
  }
  // 투명 배경은 흰색으로 채운 뒤 JPEG(0.85)로 압축
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  return canvas.toDataURL('image/jpeg', QUALITY)
}

export function imageFiles(dataTransfer) {
  return [...(dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'))
}
