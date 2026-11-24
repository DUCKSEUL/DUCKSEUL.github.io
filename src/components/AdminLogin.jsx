import { useState } from 'react'
import Modal from './Modal.jsx'
import { Icon, toast } from './ui.jsx'
import { login, loginWithGitHub, hasGitHubLogin } from '../lib/admin.js'
import { REPO } from '../config.js'

function TokenForm({ onDone }) {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = await login(token)
      toast(`관리자 모드가 켜졌어요. (${user.login})`)
      setToken('')
      onDone()
    } catch (err) {
      setError(err.message || '인증에 실패했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form id="admin-form" className="form-stack" onSubmit={submit}>
      <label>
        <span>Personal Access Token</span>
        <input
          type="password"
          autoFocus={!hasGitHubLogin}
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
        <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
          Fine-grained token
        </a>{' '}
        · 이 저장소만 · Contents: Read and write. 토큰은 이 브라우저의 localStorage에만 저장돼요.
      </p>
      <button className="btn btn-md btn-primary" type="submit" disabled={busy || !token.trim()}>
        {busy ? '확인 중…' : '토큰으로 로그인'}
      </button>
    </form>
  )
}

export default function AdminLogin({ open, onClose }) {
  const [going, setGoing] = useState(false)
  return (
    <Modal open={open} title="관리자 로그인" onClose={onClose} width={440}>
      <div className="admin-login">
        <p className="modal-text">
          <code>
            {REPO.owner}/{REPO.name}
          </code>{' '}
          저장소 관리자만 로그인할 수 있어요.
        </p>
        {hasGitHubLogin ? (
          <>
            <button
              className="btn btn-lg btn-dark gh-login"
              autoFocus
              disabled={going}
              onClick={() => {
                setGoing(true)
                loginWithGitHub()
              }}
            >
              <Icon name="github" size={20} /> {going ? 'GitHub로 이동 중…' : 'GitHub로 로그인'}
            </button>
            <details className="token-alt">
              <summary>토큰으로 직접 로그인</summary>
              <TokenForm onDone={onClose} />
            </details>
          </>
        ) : (
          <TokenForm onDone={onClose} />
        )}
      </div>
    </Modal>
  )
}
