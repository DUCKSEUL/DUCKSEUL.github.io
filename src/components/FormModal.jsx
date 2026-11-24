import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'

/**
 * 관리자용 입력 폼 모달
 * fields: [{ name, label, type?: 'text'|'textarea'|'select'|'checkbox'|'number'|'date'|'url', options?, placeholder?, required?, hint?, full? }]
 * onSubmit(values) 이 Promise를 반환하면 저장 중 표시, 실패하면 오류 문구를 보여 줍니다.
 */
export default function FormModal({ open, title, fields, initial, submitLabel = '저장', onSubmit, onClose, onDelete, width = 560 }) {
  const [values, setValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const v = {}
    for (const f of fields) v[f.name] = initial?.[f.name] ?? (f.type === 'checkbox' ? false : '')
    setValues(v)
    setError('')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }))

  const submit = async (e) => {
    e.preventDefault()
    for (const f of fields) {
      if (f.required && !String(values[f.name] ?? '').trim()) {
        setError(`${f.label}을(를) 입력해 주세요.`)
        return
      }
    }
    setBusy(true)
    setError('')
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err.message || '저장하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={() => !busy && onClose()}
      width={width}
      footer={
        <>
          {onDelete && (
            <button type="button" className="btn btn-md btn-ghost danger-text" disabled={busy} onClick={onDelete}>
              삭제
            </button>
          )}
          <button type="button" className="btn btn-md btn-ghost" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button type="submit" form="form-modal" className="btn btn-md btn-primary" disabled={busy}>
            {busy ? '저장 중…' : submitLabel}
          </button>
        </>
      }
    >
      <form id="form-modal" className="form-grid" onSubmit={submit}>
        {fields.map((f) => {
          const id = `fm-${f.name}`
          const v = values[f.name] ?? ''
          if (f.type === 'checkbox') {
            return (
              <label key={f.name} className="form-check full">
                <input type="checkbox" checked={!!v} onChange={(e) => set(f.name, e.target.checked)} />
                <span>{f.label}</span>
              </label>
            )
          }
          return (
            <label key={f.name} className={`form-field ${f.full || f.type === 'textarea' ? 'full' : ''}`} htmlFor={id}>
              <span>
                {f.label}
                {f.required && <em aria-hidden> *</em>}
              </span>
              {f.type === 'textarea' ? (
                <textarea id={id} rows={f.rows || 3} value={v} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />
              ) : f.type === 'select' ? (
                <select id={id} value={v} onChange={(e) => set(f.name, e.target.value)}>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  type={f.type || 'text'}
                  value={v}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.name, e.target.value)}
                  autoComplete="off"
                />
              )}
              {f.hint && <small>{f.hint}</small>}
            </label>
          )
        })}
        {error && (
          <p className="form-error full" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
