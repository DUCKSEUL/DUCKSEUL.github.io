// 붙여넣기(Ctrl+V)/드래그한 이미지를 자동 리사이징·압축해 data URL로 변환합니다.
//  - 가로 최대 1400px (비율 유지, 확대는 하지 않음)
//  - JPEG 품질 0.85. 단, 작은 PNG 캡처는 글자가 선명하도록 PNG를 유지
export const MAX_W = 1400
export const QUALITY = 0.85
const KEEP_PNG_BYTES = 400_000 // 이보다 작게 나오는 PNG는 그대로 PNG

export async function fileToDataUrl(file) {
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
