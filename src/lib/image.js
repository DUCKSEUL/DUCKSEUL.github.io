// 붙여넣기/드롭한 이미지를 브라우저 저장소에 맞게 축소해 data URL로 변환합니다.
const MAX_W = 1600

export async function fileToDataUrl(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_W / bitmap.width)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  // 캡처(PNG)는 글자가 선명하도록 PNG 유지, 너무 크면 JPEG로
  if (file.type === 'image/png' || file.type === 'image/gif') {
    const png = canvas.toDataURL('image/png')
    if (png.length < 1_500_000) return png
  }
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.88)
}

export function imageFiles(dataTransfer) {
  return [...(dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'))
}
