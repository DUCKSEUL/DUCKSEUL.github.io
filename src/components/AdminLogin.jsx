import { useState } from 'react'
import Modal from './Modal.jsx'
import { toast } from './ui.jsx'
import { login } from '../lib/admin.js'
import { REPO } from '../config.js'

export default function AdminLogin({ open, onClose }) {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    setToken('')
    setError('')
    onClose()
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = await login(token)
      toast(`관리자 모드가 켜졌어요. (${user.login})`)
      close()
    } catch (err) {
      setError(err.message || '인증에 실패했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title="관리자 로그인"
      onClose={close}
      width={460}
      footer={
        <>
          <button className="btn btn-md btn-ghost" onClick={close}>
            취소
          </button>
          <button className="btn btn-md btn-primary" type="submit" form="admin-form" disabled={busy || !token.trim()}>
            {busy ? '확인 중…' : '로그인'}
          </button>
        </>
      }
    >
      <form id="admin-form" className="form-stack" onSubmit={submit}>
        <p className="modal-text">
          <code>
            {REPO.owner}/{REPO.name}
          </code>{' '}
          저장소에 쓰기 권한이 있는 GitHub Personal Access Token을 입력하세요. 토큰은 이 브라우저의 localStorage에만 저장돼요.
        </p>
        <label>
          <span>Personal Access Token</span>
          <input
            type="password"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_… 또는 ghp_…"
            aria-invalid={!!error}
            aria-describedby={error ? 'admin-error' : undefined}
          />
        </label>
        {error && (
          <p id="admin-error" className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="form-hint">
          권장:{' '}
          <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
            Fine-grained token
          </a>{' '}
          · Repository access는 이 저장소만 · Permissions → Contents: Read and write
        </p>
      </form>
    </Modal>
  )
}
