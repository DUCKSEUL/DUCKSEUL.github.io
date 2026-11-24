import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './ui.jsx'

export default function BackToTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const on = () => setShow(window.scrollY > 400)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return createPortal(
    <button
      className={`to-top ${show ? 'is-shown' : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="맨 위로 이동"
      tabIndex={show ? 0 : -1}
    >
      <Icon name="chevronDown" size={22} />
    </button>,
    document.body,
  )
}
