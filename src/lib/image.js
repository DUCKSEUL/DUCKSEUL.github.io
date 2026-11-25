// 붙여넣기(Ctrl+V)/드래그한 이미지를 data URL로 변환합니다.
//  - 원본 해상도·화질 그대로 (강제 리사이즈·JPEG 재압축 없음)
//  - 에디터에서 ½·⅓로 줄여도 표시 너비만 바뀌고 원본 데이터는 고해상도 그대로
import DOMPurify from 'dompurify'

const SVG_MAX_W = 4096 // SVG 래스터화 최대 가로(2배 선명도)

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
    // 선명도를 위해 2배로 그리되 가로 최대 SVG_MAX_W
    const scale = Math.min(2, SVG_MAX_W / nw) || 1
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

// 파일 → data URL: 원본 바이트 그대로 (리사이즈·재압축 없음 → 해상도·화질 100% 유지)
const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
const KEEP_TYPES = /^image\/(png|jpeg|gif|webp)$/i

export async function fileToDataUrl(file) {
  if (isSvgFile(file)) return svgToPng(await file.text())
  // PNG(화면 캡처) · JPEG · GIF · WebP: 원본 파일 그대로 (naturalWidth × naturalHeight 유지, 무손실)
  if (KEEP_TYPES.test(file.type)) return readAsDataUrl(file)
  // 그 밖의 형식(BMP·AVIF 등): 원본 크기 그대로 무손실 PNG로만 변환 (축소 없음)
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d').drawImage(bitmap, 0, 0)
  bitmap.close?.()
  return canvas.toDataURL('image/png')
}

export function imageFiles(dataTransfer) {
  return [...(dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'))
}
