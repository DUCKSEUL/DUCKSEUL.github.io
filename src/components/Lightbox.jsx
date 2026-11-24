import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './ui.jsx'

export default function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    if (!src) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [src, onClose])

  if (!src) return null
  return createPortal(
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label="사진 크게 보기">
      <button className="lightbox-close" onClick={onClose} aria-label="닫기">
        <Icon name="close" size={26} />
      </button>
      <img src={src} alt={alt || ''} onClick={(e) => e.stopPropagation()} />
      {alt && <p className="lightbox-caption">{alt}</p>}
    </div>,
    document.body,
  )
}
